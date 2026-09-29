"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sellerRouter = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
exports.sellerRouter = router;
const prisma = new client_1.PrismaClient();
router.use(auth_1.authenticate, (0, auth_1.authorize)("SELLER"));
async function getSellerProfileId(userId) {
    const profile = await prisma.sellerProfile.findUnique({ where: { userId }, select: { id: true } });
    return profile?.id || null;
}
// =========================================================
// DASHBOARD
// =========================================================
router.get("/dashboard", async (req, res, next) => {
    try {
        const authUser = (0, auth_1.getAuthUser)(req);
        const sellerId = await getSellerProfileId(authUser.userId);
        if (!sellerId) {
            res.status(403).json({ message: "Profil seller tidak ditemukan." });
            return;
        }
        const [totalEvents, activeEvents, totalTicketsSold, staffCount] = await Promise.all([
            prisma.event.count({ where: { sellerId } }),
            prisma.event.count({ where: { sellerId, status: "ACTIVE" } }),
            prisma.ticket.count({ where: { sellerId } }),
            prisma.staffProfile.count({ where: { sellerId } }),
        ]);
        const profile = await prisma.sellerProfile.findUnique({
            where: { id: sellerId },
            select: { storeName: true, storeEmail: true, accountCode: true, subscriptionType: true, subscriptionExpiry: true },
        });
        res.json({
            profile,
            stats: { totalEvents, activeEvents, totalTicketsSold, staffCount },
        });
    }
    catch (err) {
        next(err);
    }
});
// =========================================================
// EVENTS
// =========================================================
router.get("/events", async (req, res, next) => {
    try {
        const authUser = (0, auth_1.getAuthUser)(req);
        const sellerId = await getSellerProfileId(authUser.userId);
        if (!sellerId) {
            res.status(403).json({ message: "Profil seller tidak ditemukan." });
            return;
        }
        const events = await prisma.event.findMany({
            where: { sellerId },
            include: { ticketTypes: true, _count: { select: { orders: true } } },
            orderBy: { createdAt: "desc" },
        });
        res.json(events);
    }
    catch (err) {
        next(err);
    }
});
router.post("/events", async (req, res, next) => {
    try {
        const authUser = (0, auth_1.getAuthUser)(req);
        const sellerId = await getSellerProfileId(authUser.userId);
        if (!sellerId) {
            res.status(403).json({ message: "Profil seller tidak ditemukan." });
            return;
        }
        const { name, description, banner, location, date, time, category, saleStart, saleEnd, ticketTypes, status } = req.body;
        if (!name || !location || !date || !category || !saleStart || !saleEnd) {
            res.status(400).json({ message: "Nama, lokasi, tanggal, kategori, dan periode penjualan wajib diisi." });
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
                    create: (ticketTypes || []).map((t) => ({
                        name: t.name, price: t.price, quantity: t.quantity,
                    })),
                },
            },
            include: { ticketTypes: true },
        });
        res.status(201).json(event);
    }
    catch (err) {
        next(err);
    }
});
router.put("/events/:id", async (req, res, next) => {
    try {
        const authUser = (0, auth_1.getAuthUser)(req);
        const sellerId = await getSellerProfileId(authUser.userId);
        if (!sellerId) {
            res.status(403).json({ message: "Profil seller tidak ditemukan." });
            return;
        }
        const eventId = req.params.id;
        const existing = await prisma.event.findFirst({ where: { id: eventId, sellerId } });
        if (!existing) {
            res.status(404).json({ message: "Event tidak ditemukan." });
            return;
        }
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
        res.json(event);
    }
    catch (err) {
        next(err);
    }
});
router.delete("/events/:id", async (req, res, next) => {
    try {
        const authUser = (0, auth_1.getAuthUser)(req);
        const sellerId = await getSellerProfileId(authUser.userId);
        if (!sellerId) {
            res.status(403).json({ message: "Profil seller tidak ditemukan." });
            return;
        }
        const eventId = req.params.id;
        const existing = await prisma.event.findFirst({ where: { id: eventId, sellerId } });
        if (!existing) {
            res.status(404).json({ message: "Event tidak ditemukan." });
            return;
        }
        await prisma.event.delete({ where: { id: eventId } });
        res.json({ message: "Event berhasil dihapus." });
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
        const sellerId = await getSellerProfileId(authUser.userId);
        if (!sellerId) {
            res.status(403).json({ message: "Profil seller tidak ditemukan." });
            return;
        }
        // Get events by this seller, then their orders
        const events = await prisma.event.findMany({ where: { sellerId }, select: { id: true } });
        const eventIds = events.map((e) => e.id);
        const orders = await prisma.order.findMany({
            where: { eventId: { in: eventIds } },
            include: {
                buyer: { select: { username: true, email: true } },
                event: { select: { name: true } },
                orderItems: { include: { ticketType: { select: { name: true } } } },
                payment: { select: { status: true, method: true } },
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
// STAFF
// =========================================================
router.get("/staff", async (req, res, next) => {
    try {
        const authUser = (0, auth_1.getAuthUser)(req);
        const sellerId = await getSellerProfileId(authUser.userId);
        if (!sellerId) {
            res.status(403).json({ message: "Profil seller tidak ditemukan." });
            return;
        }
        const staff = await prisma.staffProfile.findMany({
            where: { sellerId },
            include: { user: { select: { id: true, username: true, email: true, createdAt: true } } },
            orderBy: { createdAt: "desc" },
        });
        res.json(staff);
    }
    catch (err) {
        next(err);
    }
});
router.post("/staff", async (req, res, next) => {
    try {
        const authUser = (0, auth_1.getAuthUser)(req);
        const sellerId = await getSellerProfileId(authUser.userId);
        if (!sellerId) {
            res.status(403).json({ message: "Profil seller tidak ditemukan." });
            return;
        }
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            res.status(400).json({ message: "Nama, email, dan password wajib diisi." });
            return;
        }
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            res.status(409).json({ message: "Email sudah digunakan." });
            return;
        }
        const { hashPassword } = await Promise.resolve().then(() => __importStar(require("../utils/hash")));
        const hashed = await hashPassword(password);
        const result = await prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: { email, username: name.replace(/\s+/g, "").toLowerCase(), password: hashed, role: "STAFF" },
            });
            const staff = await tx.staffProfile.create({
                data: { userId: user.id, sellerId, name },
            });
            return { user, staff };
        });
        res.status(201).json({
            message: "Staf berhasil dibuat.",
            staff: { id: result.staff.id, name, email, userId: result.user.id },
        });
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
                id: true, nik: true, username: true, email: true, age: true, birthDate: true, gender: true,
                sellerProfile: true, sellerVerification: true,
            },
        });
        res.json(user);
    }
    catch (err) {
        next(err);
    }
});
//# sourceMappingURL=seller.routes.js.map