import { Router, Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate, authorize, getAuthUser } from "../middleware/auth";
import { hashPassword, comparePassword } from "../utils/hash";

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate, authorize("BUYER"));

// =========================================================
// DASHBOARD
// =========================================================

router.get("/dashboard", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authUser = getAuthUser(req);

    const [totalOrders, activeTickets, wishlistCount, unreadNotifications, user, recentOrders] = await Promise.all([
      prisma.order.count({ where: { buyerId: authUser.userId } }),
      prisma.ticket.count({ where: { buyerId: authUser.userId, status: "ACTIVE" } }),
      prisma.wishlist.count({ where: { buyerId: authUser.userId } }),
      prisma.notification.count({ where: { userId: authUser.userId, read: false } }),
      prisma.user.findUnique({ where: { id: authUser.userId }, select: { loyaltyPoints: true } }),
      prisma.order.findMany({
        where: { buyerId: authUser.userId },
        include: { event: { select: { name: true, date: true } }, payment: { select: { status: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    res.json({
      stats: {
        totalOrders, activeTickets, wishlistCount, unreadNotifications,
        loyaltyPoints: user?.loyaltyPoints || 0,
      },
      recentOrders,
    });
  } catch (err) { next(err); }
});

// =========================================================
// ORDERS
// =========================================================

router.get("/orders", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authUser = getAuthUser(req);
    const orders = await prisma.order.findMany({
      where: { buyerId: authUser.userId },
      include: {
        event: { select: { name: true, location: true, date: true, banner: true } },
        orderItems: { include: { ticketType: { select: { name: true } } } },
        payment: { select: { status: true, method: true } },
        _count: { select: { tickets: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(orders);
  } catch (err) { next(err); }
});

// =========================================================
// TICKETS
// =========================================================

router.get("/tickets", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authUser = getAuthUser(req);
    const tickets = await prisma.ticket.findMany({
      where: { buyerId: authUser.userId },
      include: {
        event: { select: { name: true, location: true, date: true, time: true, banner: true } },
        ticketType: { select: { name: true, price: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(tickets);
  } catch (err) { next(err); }
});

// =========================================================
// LOYALTY
// =========================================================

router.get("/loyalty", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authUser = getAuthUser(req);
    const user = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { loyaltyPoints: true },
    });

    const transactions = await prisma.loyaltyTransaction.findMany({
      where: { userId: authUser.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const points = user?.loyaltyPoints || 0;
    let level = "Bronze";
    if (points >= 1000) level = "Gold";
    else if (points >= 500) level = "Silver";

    res.json({ points, level, transactions });
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
        id: true, username: true, email: true, loyaltyPoints: true, createdAt: true,
        buyerProfile: {
          select: { nik: true, age: true, birthDate: true, gender: true },
        },
      },
    });
    res.json(user);
  } catch (err) { next(err); }
});

router.put("/profile", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authUser = getAuthUser(req);
    const { username, age, birthDate, gender } = req.body;

    if (username) {
      const existing = await prisma.user.findFirst({
        where: { username, id: { not: authUser.userId } },
      });
      if (existing) { res.status(409).json({ message: "Username sudah digunakan." }); return; }
    }

    // Update user
    const user = await prisma.user.update({
      where: { id: authUser.userId },
      data: {
        ...(username && { username }),
      },
      select: { id: true, username: true, email: true, loyaltyPoints: true },
    });

    // Update buyer profile
    if (age || birthDate || gender) {
      await prisma.buyerProfile.updateMany({
        where: { userId: authUser.userId },
        data: {
          ...(age && { age: parseInt(age, 10) }),
          ...(birthDate && { birthDate: new Date(birthDate) }),
          ...(gender && { gender }),
        },
      });
    }

    res.json({ message: "Profil berhasil diperbarui.", user });
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
      res.status(400).json({ message: "Password tidak dapat diubah untuk akun OAuth." });
      return;
    }

    const valid = await comparePassword(currentPassword, user.password);
    if (!valid) {
      res.status(401).json({ message: "Password lama salah." });
      return;
    }

    const hashed = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });

    res.json({ message: "Password berhasil diubah." });
  } catch (err) { next(err); }
});

export { router as buyerRouter };
