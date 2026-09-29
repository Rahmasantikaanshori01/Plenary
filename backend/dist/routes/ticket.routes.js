"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ticketRouter = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
exports.ticketRouter = router;
const prisma = new client_1.PrismaClient();
// =========================================================
// GET BUYER'S TICKETS
// =========================================================
router.get("/my-tickets", auth_1.authenticate, (0, auth_1.authorize)("BUYER"), async (req, res, next) => {
    try {
        const authUser = (0, auth_1.getAuthUser)(req);
        const tickets = await prisma.ticket.findMany({
            where: { buyerId: authUser.userId },
            include: {
                event: { select: { name: true, location: true, date: true, time: true, banner: true } },
                ticketType: { select: { name: true, price: true } },
                order: { select: { id: true, status: true } },
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
// VALIDATE QR CODE
// =========================================================
router.get("/validate/:qrToken", async (req, res, next) => {
    try {
        const qrToken = req.params.qrToken;
        const ticket = await prisma.ticket.findUnique({
            where: { qrToken },
            include: {
                event: { select: { id: true, name: true, date: true, time: true, location: true, status: true } },
                ticketType: { select: { name: true } },
                buyer: { select: { username: true } },
            },
        });
        if (!ticket) {
            res.status(404).json({ valid: false, message: "Tiket tidak ditemukan." });
            return;
        }
        // Validate ticket status
        if (ticket.status === "USED") {
            res.json({ valid: false, message: "Tiket sudah digunakan.", ticket: { id: ticket.id, status: ticket.status } });
            return;
        }
        if (ticket.status === "CANCELLED") {
            res.json({ valid: false, message: "Tiket telah dibatalkan.", ticket: { id: ticket.id, status: ticket.status } });
            return;
        }
        if (ticket.status === "EXPIRED") {
            res.json({ valid: false, message: "Tiket sudah expired.", ticket: { id: ticket.id, status: ticket.status } });
            return;
        }
        // Validate event status
        const event = ticket.event;
        if (event && event.status === "CANCELLED") {
            res.json({ valid: false, message: "Event telah dibatalkan." });
            return;
        }
        res.json({
            valid: true,
            message: "Tiket valid!",
            ticket: {
                id: ticket.id,
                status: ticket.status,
                qrCode: ticket.qrCode,
                event: ticket.event,
                ticketType: ticket.ticketType,
                buyer: ticket.buyer,
            },
        });
    }
    catch (err) {
        next(err);
    }
});
// =========================================================
// USE TICKET (mark as USED)
// =========================================================
router.post("/use/:qrToken", auth_1.authenticate, async (req, res, next) => {
    try {
        const qrToken = req.params.qrToken;
        const ticket = await prisma.ticket.findUnique({
            where: { qrToken },
            include: { event: true },
        });
        if (!ticket) {
            res.status(404).json({ message: "Tiket tidak ditemukan." });
            return;
        }
        if (ticket.status !== "ACTIVE") {
            res.status(400).json({ message: `Tiket tidak dapat digunakan. Status: ${ticket.status}` });
            return;
        }
        await prisma.ticket.update({
            where: { id: ticket.id },
            data: { status: "USED" },
        });
        res.json({ message: "Tiket berhasil divalidasi! ✅", ticketId: ticket.id });
    }
    catch (err) {
        next(err);
    }
});
//# sourceMappingURL=ticket.routes.js.map