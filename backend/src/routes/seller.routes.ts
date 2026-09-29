import { Router, Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate, authorize, getAuthUser } from "../middleware/auth";
import { hashPassword, comparePassword } from "../utils/hash";
import { ActivityLogService } from "../services/activity.service";

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate, authorize("SELLER"));

async function getSellerProfileId(userId: string): Promise<string | null> {
  const profile = await prisma.sellerProfile.findUnique({ where: { userId }, select: { id: true } });
  return profile?.id || null;
}

// =========================================================
// DASHBOARD
// =========================================================

router.get("/dashboard", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authUser = getAuthUser(req);
    const sellerId = await getSellerProfileId(authUser.userId);
    if (!sellerId) { res.status(403).json({ message: "Profil seller tidak ditemukan." }); return; }

    const [totalEvents, activeEvents, totalTicketsSold, staffCount, totalOrders, totalRevenue] = await Promise.all([
      prisma.event.count({ where: { sellerId } }),
      prisma.event.count({ where: { sellerId, status: { in: ["ACTIVE", "PUBLISHED"] } } }),
      prisma.ticket.count({ where: { sellerId } }),
      prisma.staffProfile.count({ where: { sellerId } }),
      prisma.order.count({ where: { sellerId } }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: "PAID", order: { sellerId } },
      }),
    ]);

    const profile = await prisma.sellerProfile.findUnique({
      where: { id: sellerId },
      select: {
        storeName: true, storeEmail: true, accountCode: true,
        subscriptionType: true, subscriptionExpiry: true, eventAccessDays: true,
        ownerName: true, sponsoredBy: true, organizationName: true,
      },
    });

    const subscription = await prisma.subscription.findFirst({
      where: { sellerId, status: "ACTIVE" },
      orderBy: { endDate: "desc" },
    });

    res.json({
      profile,
      subscription,
      stats: { totalEvents, activeEvents, totalTicketsSold, staffCount, totalOrders, totalRevenue: totalRevenue._sum.amount || 0 },
    });
  } catch (err) { next(err); }
});

// =========================================================
// EVENTS
// =========================================================

router.get("/events", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authUser = getAuthUser(req);
    const sellerId = await getSellerProfileId(authUser.userId);
    if (!sellerId) { res.status(403).json({ message: "Profil seller tidak ditemukan." }); return; }

    const events = await prisma.event.findMany({
      where: { sellerId },
      include: { ticketTypes: true, _count: { select: { orders: true, tickets: true } } },
      orderBy: { createdAt: "desc" },
    });

    res.json(events);
  } catch (err) { next(err); }
});

router.post("/events", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authUser = getAuthUser(req);
    const sellerId = await getSellerProfileId(authUser.userId);
    if (!sellerId) { res.status(403).json({ message: "Profil seller tidak ditemukan." }); return; }

    const { name, description, banner, location, date, time, category, saleStart, saleEnd, ticketTypes, status } = req.body;

    if (!name || !location || !date || !category || !saleStart || !saleEnd) {
      res.status(400).json({ message: "Nama, lokasi, tanggal, kategori, dan periode penjualan wajib diisi." });
      return;
    }

    // Validate category is entertainment-related
    const validCategories = ["konser", "teater", "film", "pertunjukan", "musik", "show", "entertainment", "festival", "komedi", "pameran", "workshop"];
    if (!validCategories.includes(category.toLowerCase())) {
      res.status(400).json({ message: "Kategori event harus berhubungan dengan hiburan/pertunjukan." });
      return;
    }

    const event = await prisma.event.create({
      data: {
        sellerId,
        name,
        description: description || null,
        banner: banner || null,
        location,
        date: new Date(date),
        time: time || null,
        category,
        saleStart: new Date(saleStart),
        saleEnd: new Date(saleEnd),
        status: status || "DRAFT",
        ticketTypes: {
          create: (ticketTypes || []).map((t: { name: string; price: number; quantity: number; saleStart?: string; saleEnd?: string }) => ({
            name: t.name, price: t.price, quantity: t.quantity,
            saleStart: t.saleStart ? new Date(t.saleStart) : null,
            saleEnd: t.saleEnd ? new Date(t.saleEnd) : null,
          })),
        },
      },
      include: { ticketTypes: true },
    });

    await ActivityLogService.log({
      userId: authUser.userId, role: "SELLER", action: "CREATE_EVENT",
      entity: "event", entityId: event.id, details: `Created event: ${name}`,
    });

    res.status(201).json(event);
  } catch (err) { next(err); }
});

router.put("/events/:id", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authUser = getAuthUser(req);
    const sellerId = await getSellerProfileId(authUser.userId);
    if (!sellerId) { res.status(403).json({ message: "Profil seller tidak ditemukan." }); return; }

    const eventId = req.params.id as string;
    const existing = await prisma.event.findFirst({ where: { id: eventId, sellerId } });
    if (!existing) { res.status(404).json({ message: "Event tidak ditemukan." }); return; }

    const { name, description, banner, location, date, time, category, saleStart, saleEnd, status } = req.body;

    const event = await prisma.event.update({
      where: { id: eventId },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(banner !== undefined && { banner }),
        ...(location && { location }),
        ...(date && { date: new Date(date) }),
        ...(time !== undefined && { time }),
        ...(category && { category }),
        ...(saleStart && { saleStart: new Date(saleStart) }),
        ...(saleEnd && { saleEnd: new Date(saleEnd) }),
        ...(status && { status }),
      },
      include: { ticketTypes: true },
    });

    await ActivityLogService.log({
      userId: authUser.userId, role: "SELLER", action: "UPDATE_EVENT",
      entity: "event", entityId: event.id, details: `Updated event: ${event.name}`,
    });

    res.json(event);
  } catch (err) { next(err); }
});

router.delete("/events/:id", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authUser = getAuthUser(req);
    const sellerId = await getSellerProfileId(authUser.userId);
    if (!sellerId) { res.status(403).json({ message: "Profil seller tidak ditemukan." }); return; }

    const eventId = req.params.id as string;
    const existing = await prisma.event.findFirst({ where: { id: eventId, sellerId } });
    if (!existing) { res.status(404).json({ message: "Event tidak ditemukan." }); return; }

    await prisma.event.delete({ where: { id: eventId } });

    await ActivityLogService.log({
      userId: authUser.userId, role: "SELLER", action: "DELETE_EVENT",
      entity: "event", entityId: eventId, details: `Deleted event: ${existing.name}`,
    });

    res.json({ message: "Event berhasil dihapus." });
  } catch (err) { next(err); }
});

// =========================================================
// TICKET TYPES
// =========================================================

router.post("/events/:eventId/ticket-types", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authUser = getAuthUser(req);
    const sellerId = await getSellerProfileId(authUser.userId);
    if (!sellerId) { res.status(403).json({ message: "Profil seller tidak ditemukan." }); return; }

    const eventId = String(req.params.eventId);
    const event = await prisma.event.findFirst({ where: { id: eventId, sellerId } });
    if (!event) { res.status(404).json({ message: "Event tidak ditemukan." }); return; }

    const { name, price, quantity, saleStart, saleEnd } = req.body;
    if (!name || price === undefined || !quantity) {
      res.status(400).json({ message: "Nama, harga, dan jumlah tiket wajib diisi." });
      return;
    }

    const ticketType = await prisma.ticketType.create({
      data: {
        eventId, name, price: parseFloat(price), quantity: parseInt(quantity, 10),
        saleStart: saleStart ? new Date(saleStart) : null,
        saleEnd: saleEnd ? new Date(saleEnd) : null,
      },
    });

    res.status(201).json(ticketType);
  } catch (err) { next(err); }
});

// =========================================================
// ORDERS
// =========================================================

router.get("/orders", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authUser = getAuthUser(req);
    const sellerId = await getSellerProfileId(authUser.userId);
    if (!sellerId) { res.status(403).json({ message: "Profil seller tidak ditemukan." }); return; }

    const orders = await prisma.order.findMany({
      where: { sellerId },
      include: {
        buyer: { select: { username: true, email: true } },
        event: { select: { name: true } },
        orderItems: { include: { ticketType: { select: { name: true } } } },
        payment: { select: { status: true, method: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(orders);
  } catch (err) { next(err); }
});

// =========================================================
// STAFF
// =========================================================

router.get("/staff", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authUser = getAuthUser(req);
    const sellerId = await getSellerProfileId(authUser.userId);
    if (!sellerId) { res.status(403).json({ message: "Profil seller tidak ditemukan." }); return; }

    const staff = await prisma.staffProfile.findMany({
      where: { sellerId },
      include: { user: { select: { id: true, username: true, email: true, createdAt: true } } },
      orderBy: { createdAt: "desc" },
    });

    res.json(staff);
  } catch (err) { next(err); }
});

router.post("/staff", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authUser = getAuthUser(req);
    const sellerId = await getSellerProfileId(authUser.userId);
    if (!sellerId) { res.status(403).json({ message: "Profil seller tidak ditemukan." }); return; }

    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ message: "Nama, email, dan password wajib diisi." });
      return;
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) { res.status(409).json({ message: "Email sudah digunakan." }); return; }

    const hashed = await hashPassword(password);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, username: name.replace(/\s+/g, "").toLowerCase(), password: hashed, role: "STAFF" },
      });
      const staff = await tx.staffProfile.create({
        data: { userId: user.id, sellerId, name, email },
      });
      return { user, staff };
    });

    res.status(201).json({
      message: "Staf berhasil dibuat.",
      staff: { id: result.staff.id, name, email, userId: result.user.id },
    });
  } catch (err) { next(err); }
});

// =========================================================
// PROFILE
// =========================================================

router.get("/profile", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authUser = getAuthUser(req);
    const user = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: {
        id: true, username: true, email: true,
        sellerProfile: true, sellerVerification: true,
      },
    });
    res.json(user);
  } catch (err) { next(err); }
});

router.put("/profile", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authUser = getAuthUser(req);
    const sellerId = await getSellerProfileId(authUser.userId);
    if (!sellerId) { res.status(403).json({ message: "Profil seller tidak ditemukan." }); return; }

    const { storeDescription, storeAddress, sponsoredBy, organizationName, organizationType } = req.body;

    await prisma.sellerProfile.update({
      where: { id: sellerId },
      data: {
        ...(storeDescription !== undefined && { storeDescription }),
        ...(storeAddress !== undefined && { storeAddress }),
        ...(sponsoredBy !== undefined && { sponsoredBy }),
        ...(organizationName !== undefined && { organizationName }),
        ...(organizationType !== undefined && { organizationType }),
      },
    });

    res.json({ message: "Profil seller berhasil diperbarui." });
  } catch (err) { next(err); }
});

// =========================================================
// CHANGE PASSWORD
// =========================================================

router.post("/change-password", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authUser = getAuthUser(req);
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ message: "Password lama dan baru wajib diisi." });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ message: "Password baru minimal 6 karakter." });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: authUser.userId } });
    if (!user || !user.password) {
      res.status(400).json({ message: "Password tidak ditemukan." });
      return;
    }

    const valid = await comparePassword(currentPassword, user.password);
    if (!valid) {
      res.status(401).json({ message: "Password lama salah." });
      return;
    }

    const hashed = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, mustChangePassword: false },
    });

    res.json({ message: "Password berhasil diubah." });
  } catch (err) { next(err); }
});

// =========================================================
// SUBSCRIPTION
// =========================================================

router.get("/subscription", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authUser = getAuthUser(req);
    const sellerId = await getSellerProfileId(authUser.userId);
    if (!sellerId) { res.status(403).json({ message: "Profil seller tidak ditemukan." }); return; }

    const profile = await prisma.sellerProfile.findUnique({
      where: { id: sellerId },
      select: { subscriptionType: true, subscriptionExpiry: true, eventAccessDays: true },
    });

    const subscriptions = await prisma.subscription.findMany({
      where: { sellerId },
      orderBy: { createdAt: "desc" },
    });

    const activeSubscription = subscriptions.find((s) => s.status === "ACTIVE" && new Date(s.endDate) > new Date());

    res.json({ profile, subscriptions, activeSubscription });
  } catch (err) { next(err); }
});

export { router as sellerRouter };
