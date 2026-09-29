import { Router, Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate, authorize, getAuthUser } from "../middleware/auth";
import { hashPassword } from "../utils/hash";
import { NotificationService } from "../services/notification.service";
import { ActivityLogService } from "../services/activity.service";
import { EmailService } from "../services/email.service";
import { v4 as uuidv4 } from "uuid";

const router = Router();
const prisma = new PrismaClient();

// Helper: safely extract string from query param
function qs(val: unknown): string | undefined {
  if (typeof val === "string") return val;
  if (Array.isArray(val) && typeof val[0] === "string") return val[0];
  return undefined;
}
function qsOrDefault(val: unknown, def: string): string {
  const v = qs(val);
  return v !== undefined ? v : def;
}

// All admin routes require ADMIN role
router.use(authenticate, authorize("ADMIN"));

// =========================================================
// DASHBOARD STATS
// =========================================================

router.get("/stats", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const [
      totalBuyers, totalSellers, totalStaff, totalEvents,
      activeEvents, completedEvents, activeTickets, soldTickets,
      totalOrders, totalRevenue, pendingVerifications,
    ] = await Promise.all([
      prisma.user.count({ where: { role: "BUYER" } }),
      prisma.user.count({ where: { role: "SELLER" } }),
      prisma.user.count({ where: { role: "STAFF" } }),
      prisma.event.count(),
      prisma.event.count({ where: { status: { in: ["ACTIVE", "PUBLISHED"] } } }),
      prisma.event.count({ where: { status: "COMPLETED" } }),
      prisma.ticket.count({ where: { status: "ACTIVE" } }),
      prisma.ticket.count({ where: { status: "USED" } }),
      prisma.order.count(),
      prisma.payment.aggregate({ _sum: { amount: true }, where: { status: "PAID" } }),
      prisma.sellerApplication.count({ where: { status: "PENDING" } }),
    ]);

    res.json({
      totalBuyers, totalSellers, totalStaff, totalEvents,
      activeEvents, completedEvents, activeTickets, soldTickets,
      totalOrders, totalRevenue: totalRevenue._sum.amount || 0,
      pendingVerifications,
    });
  } catch (err) { next(err); }
});

// =========================================================
// SELLER APPLICATIONS
// =========================================================

router.get("/seller-applications", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const status = req.query.status as string | undefined;
    const page = parseInt((req.query.page as string) || "1", 10);
    const limit = parseInt((req.query.limit as string) || "20", 10);
    const where = status ? { status: status as "PENDING" | "APPROVED" | "REJECTED" } : {};

    const [applications, total] = await Promise.all([
      prisma.sellerApplication.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
      prisma.sellerApplication.count({ where }),
    ]);
    res.json({ applications, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

router.get("/seller-applications/:id", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const application = await prisma.sellerApplication.findUnique({ where: { id: String(req.params.id) } });
    if (!application) { res.status(404).json({ message: "Aplikasi seller tidak ditemukan." }); return; }
    res.json(application);
  } catch (err) { next(err); }
});

// =========================================================
// APPROVE SELLER
// =========================================================

router.post("/seller-applications/:id/approve", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authUser = getAuthUser(req);
    const application = await prisma.sellerApplication.findUnique({ where: { id: String(req.params.id) } });
    if (!application) { res.status(404).json({ message: "Aplikasi seller tidak ditemukan." }); return; }
    if (application.status !== "PENDING") { res.status(400).json({ message: "Aplikasi ini sudah diproses." }); return; }

    // Generate unique account code: PLN-XXXX-XXXX
    const generateAccountCode = (): string => {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      const part1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
      const part2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
      return `PLN-${part1}-${part2}`;
    };
    let accountCode = generateAccountCode();
    while (await prisma.sellerProfile.findUnique({ where: { accountCode } })) { accountCode = generateAccountCode(); }

    // Generate store email
    const domain = process.env.PLENARY_DOMAIN || "plenary.id";
    let emailUsername = application.ownerName.split(" ")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
    let storeEmail = `${emailUsername}@${domain}`;
    let counter = 1;
    while (await prisma.sellerProfile.findUnique({ where: { storeEmail } })) {
      storeEmail = `${emailUsername}${String(counter).padStart(2, "0")}@${domain}`;
      counter++;
    }

    // Generate temporary password
    const nameParts = application.ownerName.split(" ");
    const lastName = nameParts[nameParts.length - 1].toLowerCase();
    const approvedCount = await prisma.sellerProfile.count();
    const tempPassword = `${lastName}${String(approvedCount + 1).padStart(2, "0")}plenary`;
    const hashedPassword = await hashPassword(tempPassword);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: storeEmail,
          username: application.ownerName.replace(/\s+/g, "").toLowerCase(),
          password: hashedPassword,
          role: "SELLER",
          mustChangePassword: true,
        },
      });

      const sellerProfile = await tx.sellerProfile.create({
        data: {
          userId: user.id,
          nik: application.nik,
          ownerName: application.ownerName,
          age: application.age,
          birthDate: application.birthDate,
          gender: application.gender,
          storeName: application.storeName,
          storeDescription: application.storeDescription,
          storeAddress: application.storeAddress,
          storeEmail,
          accountCode,
          sponsoredBy: application.sponsoredBy || application.organizationName,
          organizationName: application.organizationName,
          organizationType: application.organizationType,
        },
      });

      await tx.sellerVerification.create({
        data: {
          userId: user.id,
          nik: application.nik,
          ownerName: application.ownerName,
          age: application.age,
          birthDate: application.birthDate,
          gender: application.gender,
          storeName: application.storeName,
          storeDescription: application.storeDescription,
          storeAddress: application.storeAddress,
          storeEmail,
          status: "APPROVED",
          accountCode,
          approvedAt: new Date(),
          adminId: authUser.userId,
          sponsoredBy: application.sponsoredBy,
          organizationName: application.organizationName,
          organizationType: application.organizationType,
          applicationId: application.id,
        },
      });

      // Create FREE subscription
      const now = new Date();
      const endDate = new Date(now);
      endDate.setDate(endDate.getDate() + 7);
      await tx.subscription.create({
        data: { sellerId: sellerProfile.id, plan: "FREE", startDate: now, endDate, status: "ACTIVE" },
      });

      await tx.sellerApplication.update({
        where: { id: application.id },
        data: { status: "APPROVED", adminNotes: req.body.notes || null },
      });

      return { user, sellerProfile };
    });

    await EmailService.sendSellerApproval({
      to: application.storeEmail, ownerName: application.ownerName,
      storeName: application.storeName, storeEmail, temporaryPassword: tempPassword, accountCode,
    });

    await ActivityLogService.log({
      userId: authUser.userId, role: "ADMIN", action: "SELLER_APPROVAL",
      entity: "seller_application", entityId: application.id,
      details: `Approved seller: ${application.storeName}`,
    });

    res.json({
      message: "Seller berhasil disetujui!",
      seller: { userId: result.user.id, storeEmail, accountCode, storeName: result.sellerProfile.storeName },
    });
  } catch (err) { next(err); }
});

// =========================================================
// REJECT SELLER
// =========================================================

router.post("/seller-applications/:id/reject", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authUser = getAuthUser(req);
    const { reason } = req.body;
    const application = await prisma.sellerApplication.findUnique({ where: { id: String(req.params.id) } });
    if (!application) { res.status(404).json({ message: "Aplikasi seller tidak ditemukan." }); return; }
    if (application.status !== "PENDING") { res.status(400).json({ message: "Aplikasi ini sudah diproses." }); return; }

    await prisma.sellerApplication.update({
      where: { id: application.id },
      data: { status: "REJECTED", adminNotes: reason || null },
    });

    await EmailService.sendSellerRejection({
      to: application.storeEmail, ownerName: application.ownerName,
      storeName: application.storeName, reason,
    });

    await ActivityLogService.log({
      userId: authUser.userId, role: "ADMIN", action: "SELLER_REJECTION",
      entity: "seller_application", entityId: application.id,
      details: `Rejected seller: ${application.storeName}. Reason: ${reason || "N/A"}`,
    });

    res.json({ message: "Aplikasi seller ditolak." });
  } catch (err) { next(err); }
});

// =========================================================
// USERS MANAGEMENT
// =========================================================

router.get("/users", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const role = req.query.role as string | undefined;
    const search = req.query.search as string | undefined;
    const page = parseInt((req.query.page as string) || "1", 10);
    const limit = parseInt((req.query.limit as string) || "20", 10);

    const where: Record<string, unknown> = {};
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { username: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true, username: true, email: true, role: true,
          loyaltyPoints: true, createdAt: true, updatedAt: true,
          buyerProfile: { select: { nik: true, age: true, gender: true } },
          sellerProfile: { select: { storeName: true, accountCode: true, storeEmail: true, ownerName: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ users, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

router.get("/users/:id", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: String(req.params.id) },
      select: {
        id: true, username: true, email: true, role: true,
        loyaltyPoints: true, createdAt: true, updatedAt: true,
        buyerProfile: true,
        sellerProfile: true,
        sellerVerification: true,
        staffProfile: true,
      },
    });
    if (!user) { res.status(404).json({ message: "User tidak ditemukan." }); return; }
    res.json(user);
  } catch (err) { next(err); }
});

// =========================================================
// EVENTS MANAGEMENT
// =========================================================

router.get("/events", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt((req.query.page as string) || "1", 10);
    const limit = parseInt((req.query.limit as string) || "20", 10);
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (search) where.name = { contains: search };

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        include: {
          seller: { select: { storeName: true } },
          ticketTypes: true,
          _count: { select: { orders: true, tickets: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.event.count({ where }),
    ]);

    res.json({ events, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

router.patch("/events/:id/status", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authUser = getAuthUser(req);
    const { status } = req.body;
    const event = await prisma.event.findUnique({ where: { id: String(req.params.id) } });
    if (!event) { res.status(404).json({ message: "Event tidak ditemukan." }); return; }

    await prisma.event.update({ where: { id: String(req.params.id) }, data: { status } });

    await ActivityLogService.log({
      userId: authUser.userId, role: "ADMIN", action: "UPDATE_EVENT_STATUS",
      entity: "event", entityId: String(req.params.id),
      details: `Changed event "${event.name}" status from ${event.status} to ${status}`,
    });

    res.json({ message: `Status event diperbarui menjadi ${status}.` });
  } catch (err) { next(err); }
});

// =========================================================
// TICKETS MANAGEMENT
// =========================================================

router.get("/tickets", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt((req.query.page as string) || "1", 10);
    const limit = parseInt((req.query.limit as string) || "20", 10);
    const status = req.query.status as string | undefined;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: {
          event: { select: { name: true } },
          ticketType: { select: { name: true, price: true } },
          buyer: { select: { username: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.ticket.count({ where }),
    ]);

    res.json({ tickets, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

// =========================================================
// ORDERS MANAGEMENT
// =========================================================

router.get("/orders", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt((req.query.page as string) || "1", 10);
    const limit = parseInt((req.query.limit as string) || "20", 10);
    const status = req.query.status as string | undefined;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          buyer: { select: { username: true, email: true } },
          event: { select: { name: true } },
          payment: { select: { status: true, method: true, transactionId: true, amount: true } },
          _count: { select: { tickets: true, orderItems: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    res.json({ orders, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

// =========================================================
// PAYMENTS MANAGEMENT
// =========================================================

router.get("/payments", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt((req.query.page as string) || "1", 10);
    const limit = parseInt((req.query.limit as string) || "20", 10);
    const status = req.query.status as string | undefined;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          order: {
            select: { id: true, buyerId: true, totalAmount: true, buyer: { select: { username: true, email: true } }, event: { select: { name: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ]);

    res.json({ payments, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

// =========================================================
// SUBSCRIPTIONS MANAGEMENT
// =========================================================

router.get("/subscriptions", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt((req.query.page as string) || "1", 10);
    const limit = parseInt((req.query.limit as string) || "20", 10);

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        include: { seller: { select: { storeName: true, storeEmail: true, ownerName: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.subscription.count(),
    ]);

    res.json({ subscriptions, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

// =========================================================
// MESSAGES
// =========================================================

router.get("/messages", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const channel = req.query.channel as string | undefined;
    const page = parseInt((req.query.page as string) || "1", 10);
    const limit = parseInt((req.query.limit as string) || "20", 10);
    const where: Record<string, unknown> = {};
    if (channel) where.channel = channel;

    const [messages, total] = await Promise.all([
      prisma.sellerMessage.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
      prisma.sellerMessage.count({ where }),
    ]);

    res.json({ messages, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

router.patch("/messages/:id/read", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await prisma.sellerMessage.update({ where: { id: String(req.params.id) }, data: { read: true } });
    res.json({ message: "Pesan ditandai sudah dibaca." });
  } catch (err) { next(err); }
});

// =========================================================
// NOTIFICATIONS
// =========================================================

router.get("/notifications", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authUser = getAuthUser(req);
    const notifications = await NotificationService.getByUser(authUser.userId);
    const unreadCount = await NotificationService.getUnreadCount(authUser.userId);
    res.json({ notifications, unreadCount });
  } catch (err) { next(err); }
});

// =========================================================
// ACTIVITY LOGS
// =========================================================

router.get("/activity-logs", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt((req.query.page as string) || "1", 10);
    const limit = parseInt((req.query.limit as string) || "50", 10);
    const action = req.query.action as string | undefined;

    const [logs, total] = await Promise.all([
      ActivityLogService.getAll({ action, limit, offset: (page - 1) * limit }),
      ActivityLogService.count({ action }),
    ]);

    res.json({ logs, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

// =========================================================
// REPORTS
// =========================================================

router.get("/reports", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const [
      totalSales, totalOrders, ticketsSold, totalRevenue,
      activeBuyers, activeSellers, totalEvents,
      ordersByStatus, paymentsByStatus,
    ] = await Promise.all([
      prisma.order.count({ where: { status: "PAID" } }),
      prisma.order.count(),
      prisma.ticket.count(),
      prisma.payment.aggregate({ _sum: { amount: true }, where: { status: "PAID" } }),
      prisma.user.count({ where: { role: "BUYER" } }),
      prisma.user.count({ where: { role: "SELLER" } }),
      prisma.event.count(),
      prisma.order.groupBy({ by: ["status"], _count: true }),
      prisma.payment.groupBy({ by: ["status"], _count: true }),
    ]);

    res.json({
      totalSales, totalOrders, ticketsSold,
      totalRevenue: totalRevenue._sum.amount || 0,
      activeBuyers, activeSellers, totalEvents,
      ordersByStatus: Object.fromEntries(ordersByStatus.map((o) => [o.status, o._count])),
      paymentsByStatus: Object.fromEntries(paymentsByStatus.map((p) => [p.status, p._count])),
    });
  } catch (err) { next(err); }
});

// =========================================================
// SETTINGS
// =========================================================

router.get("/settings", async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.json({
      platform: {
        name: "PLENARY",
        domain: process.env.PLENARY_DOMAIN || "plenary.id",
        adminEmail: process.env.ADMIN_EMAIL || "admin@plenary.id",
        adminWhatsapp: process.env.ADMIN_WHATSAPP || "",
      },
      integrations: {
        google: !!process.env.GOOGLE_CLIENT_ID,
        facebook: !!process.env.FACEBOOK_APP_ID,
        tiktok: !!process.env.TIKTOK_CLIENT_KEY,
        email: !!(process.env.EMAIL_HOST && process.env.EMAIL_USER),
        whatsapp: !!(process.env.WHATSAPP_API_URL && process.env.WHATSAPP_ACCESS_TOKEN),
        payment: !!(process.env.PAYMENT_API_KEY && process.env.PAYMENT_SERVER_KEY),
      },
      packages: {
        free: { eventAccessDays: 7, extensionDays: 5, salePeriodDays: 15 },
        paid1m: { durationDays: 30, description: "1 Bulan" },
        paid3m: { durationDays: 90, description: "3 Bulan" },
      },
    });
  } catch (err) { next(err); }
});

export { router as adminRouter };
