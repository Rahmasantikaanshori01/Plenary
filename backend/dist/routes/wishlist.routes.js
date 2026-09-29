"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wishlistRouter = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
exports.wishlistRouter = router;
const prisma = new client_1.PrismaClient();
// GET /api/wishlist — Get buyer's wishlist
router.get("/", auth_1.authenticate, (0, auth_1.authorize)("BUYER"), async (req, res, next) => {
    try {
        const authUser = (0, auth_1.getAuthUser)(req);
        const wishlists = await prisma.wishlist.findMany({
            where: { buyerId: authUser.userId },
            include: {
                event: {
                    include: {
                        seller: { select: { storeName: true } },
                        ticketTypes: { select: { price: true } },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });
        res.json(wishlists);
    }
    catch (err) {
        next(err);
    }
});
// POST /api/wishlist/:eventId — Toggle wishlist
router.post("/:eventId", auth_1.authenticate, (0, auth_1.authorize)("BUYER"), async (req, res, next) => {
    try {
        const authUser = (0, auth_1.getAuthUser)(req);
        const eventId = req.params.eventId;
        const buyerId = authUser.userId;
        const existing = await prisma.wishlist.findUnique({
            where: { buyerId_eventId: { buyerId, eventId } },
        });
        if (existing) {
            await prisma.wishlist.delete({ where: { id: existing.id } });
            res.json({ message: "Event dihapus dari wishlist.", saved: false });
        }
        else {
            await prisma.wishlist.create({ data: { buyerId, eventId } });
            res.json({ message: "Event disimpan ke wishlist.", saved: true });
        }
    }
    catch (err) {
        next(err);
    }
});
//# sourceMappingURL=wishlist.routes.js.map