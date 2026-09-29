"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventRouter = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
exports.eventRouter = router;
const prisma = new client_1.PrismaClient();
// GET /api/events — List events (public)
router.get("/", async (req, res, next) => {
    try {
        const category = req.query.category;
        const search = req.query.search;
        const page = parseInt(req.query.page || "1", 10);
        const limit = parseInt(req.query.limit || "12", 10);
        const skip = (page - 1) * limit;
        const where = { status: "ACTIVE" };
        if (category && category !== "all") {
            where.category = category;
        }
        if (search) {
            where.name = { contains: search };
        }
        const [events, total] = await Promise.all([
            prisma.event.findMany({
                where,
                include: {
                    seller: { select: { storeName: true } },
                    ticketTypes: { select: { id: true, name: true, price: true, quantity: true, quantitySold: true } },
                },
                orderBy: { date: "asc" },
                skip,
                take: limit,
            }),
            prisma.event.count({ where }),
        ]);
        res.json({ events, total, page, totalPages: Math.ceil(total / limit) });
    }
    catch (err) {
        next(err);
    }
});
// GET /api/events/:id — Event detail (public)
router.get("/:id", async (req, res, next) => {
    try {
        const event = await prisma.event.findUnique({
            where: { id: req.params.id },
            include: {
                seller: { select: { storeName: true } },
                ticketTypes: true,
            },
        });
        if (!event) {
            res.status(404).json({ message: "Event tidak ditemukan." });
            return;
        }
        res.json(event);
    }
    catch (err) {
        next(err);
    }
});
// POST /api/events — Create event (seller only)
router.post("/", auth_1.authenticate, (0, auth_1.authorize)("SELLER"), async (req, res, next) => {
    try {
        const authUser = (0, auth_1.getAuthUser)(req);
        const profile = await prisma.sellerProfile.findUnique({ where: { userId: authUser.userId } });
        if (!profile) {
            res.status(403).json({ message: "Profil seller tidak ditemukan." });
            return;
        }
        const { name, description, banner, location, date, time, category, saleStart, saleEnd, ticketTypes } = req.body;
        const event = await prisma.event.create({
            data: {
                sellerId: profile.id,
                name,
                description,
                banner,
                location,
                date: new Date(date),
                time,
                category,
                saleStart: new Date(saleStart),
                saleEnd: new Date(saleEnd),
                ticketTypes: {
                    create: (ticketTypes || []).map((t) => ({
                        name: t.name,
                        price: t.price,
                        quantity: t.quantity,
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
//# sourceMappingURL=event.routes.js.map