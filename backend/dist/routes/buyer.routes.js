"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buyerRouter = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
exports.buyerRouter = router;
const prisma = new client_1.PrismaClient();
router.use(auth_1.authenticate, (0, auth_1.authorize)("BUYER"));
// =========================================================
// DASHBOARD
// =========================================================
router.get("/dashboard", async (req, res, next) => {
    try {
        const authUser = (0, auth_1.getAuthUser)(req);
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
    }
    catch (err) {
        next(err);
    }
});
// =========================================================
// ORDERS
// =========================================================
router.get("/orders", async (req, res, next) => {
    try {
        const authUser = (0, auth_1.getAuthUser)(req);
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
    }
    catch (err) {
        next(err);
    }
});
// =========================================================
// TICKETS
// =========================================================
router.get("/tickets", async (req, res, next) => {
    try {
        const authUser = (0, auth_1.getAuthUser)(req);
        const tickets = await prisma.ticket.findMany({
            where: { buyerId: authUser.userId },
            include: {
                ticketType: { select: { name: true, price: true } },
            },
            orderBy: { createdAt: "desc" },
        });
        res.json(tickets);
    }
    catch (err) {
        next(err);
    }
});
// =========================================================
// LOYALTY
// =========================================================
router.get("/loyalty", async (req, res, next) => {
    try {
        const authUser = (0, auth_1.getAuthUser)(req);
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
        if (points >= 1000)
            level = "Gold";
        else if (points >= 500)
            level = "Silver";
        res.json({ points, level, transactions });
    }
    catch (err) {
        next(err);
    }
});
// =========================================================
// PROFILE
// =========================================================
router.get("/profile", async (req, res, next) => {
    try {
        const authUser = (0, auth_1.getAuthUser)(req);
        const user = await prisma.user.findUnique({
            where: { id: authUser.userId },
            select: {
                id: true, nik: true, username: true, email: true, age: true,
                birthDate: true, gender: true, loyaltyPoints: true, createdAt: true,
            },
        });
        res.json(user);
    }
    catch (err) {
        next(err);
    }
});
router.put("/profile", async (req, res, next) => {
    try {
        const authUser = (0, auth_1.getAuthUser)(req);
        const { username, age, birthDate, gender } = req.body;
        if (username) {
            const existing = await prisma.user.findFirst({
                where: { username, id: { not: authUser.userId } },
            });
            if (existing) {
                res.status(409).json({ message: "Username sudah digunakan." });
                return;
            }
        }
        const user = await prisma.user.update({
            where: { id: authUser.userId },
            data: {
                ...(username && { username }),
                ...(age && { age: parseInt(age, 10) }),
                ...(birthDate && { birthDate: new Date(birthDate) }),
                ...(gender && { gender }),
            },
            select: { id: true, username: true, email: true, age: true, birthDate: true, gender: true, loyaltyPoints: true },
        });
        res.json({ message: "Profil berhasil diperbarui.", user });
    }
    catch (err) {
        next(err);
    }
});
//# sourceMappingURL=buyer.routes.js.map