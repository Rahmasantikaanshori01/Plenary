"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderRouter = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const payment_service_1 = require("../services/payment.service");
const router = (0, express_1.Router)();
exports.orderRouter = router;
const prisma = new client_1.PrismaClient();
// =========================================================
// CREATE ORDER (Buyer only)
// =========================================================
router.post("/", auth_1.authenticate, (0, auth_1.authorize)("BUYER"), async (req, res, next) => {
    try {
        const authUser = (0, auth_1.getAuthUser)(req);
        const { eventId, items } = req.body;
        if (!eventId || !items || !Array.isArray(items) || items.length === 0) {
            res.status(400).json({ message: "Event dan item tiket wajib diisi." });
            return;
        }
        const event = await prisma.event.findUnique({
            where: { id: eventId },
            include: { ticketTypes: true, seller: { select: { id: true } } },
        });
        if (!event) {
            res.status(404).json({ message: "Event tidak ditemukan." });
            return;
        }
        if (event.status !== "ACTIVE") {
            res.status(400).json({ message: "Event tidak tersedia untuk pembelian." });
            return;
        }
        const now = new Date();
        if (now < event.saleStart || now > event.saleEnd) {
            res.status(400).json({ message: "Periode penjualan tiket sudah berakhir atau belum dimulai." });
            return;
        }
        const order = await prisma.$transaction(async (tx) => {
            let totalAmount = 0;
            const orderItemsData = [];
            for (const item of items) {
                const ticketType = event.ticketTypes.find((t) => t.id === item.ticketTypeId);
                if (!ticketType)
                    throw new Error(`Tipe tiket tidak ditemukan.`);
                const available = ticketType.quantity - ticketType.quantitySold;
                if (item.quantity > available)
                    throw new Error(`Stok tiket "${ticketType.name}" tidak mencukupi. Tersisa ${available}.`);
                if (item.quantity <= 0)
                    throw new Error(`Jumlah tiket harus lebih dari 0.`);
                await tx.ticketType.update({
                    where: { id: item.ticketTypeId },
                    data: { quantitySold: { increment: item.quantity } },
                });
                totalAmount += ticketType.price * item.quantity;
                orderItemsData.push({ ticketTypeId: item.ticketTypeId, quantity: item.quantity, price: ticketType.price });
            }
            const newOrder = await tx.order.create({
                data: {
                    buyerId: authUser.userId,
                    eventId,
                    totalAmount,
                    orderItems: { create: orderItemsData },
                },
                include: { orderItems: { include: { ticketType: { select: { name: true } } } } },
            });
            await tx.payment.create({
                data: { orderId: newOrder.id, amount: totalAmount, status: "PENDING" },
            });
            return newOrder;
        });
        const paymentResult = await payment_service_1.PaymentService.createPayment({
            orderId: order.id,
            amount: order.totalAmount,
            buyerEmail: authUser.email || "",
            buyerName: authUser.email || "Buyer",
            description: `Tiket untuk ${event.name}`,
            items: order.orderItems.map((oi) => ({
                name: oi.ticketType.name,
                price: oi.price,
                quantity: oi.quantity,
            })),
        });
        if (paymentResult.transactionId) {
            await prisma.payment.update({
                where: { orderId: order.id },
                data: { transactionId: paymentResult.transactionId },
            });
        }
        res.status(201).json({
            message: "Order berhasil dibuat.",
            order: { id: order.id, totalAmount: order.totalAmount, status: order.status },
            payment: { paymentUrl: paymentResult.paymentUrl, status: paymentResult.status },
        });
    }
    catch (err) {
        if (err instanceof Error && (err.message.includes("Stok") || err.message.includes("tiket"))) {
            res.status(400).json({ message: err.message });
            return;
        }
        next(err);
    }
});
// =========================================================
// GET ORDER DETAIL
// =========================================================
router.get("/:id", auth_1.authenticate, async (req, res, next) => {
    try {
        const authUser = (0, auth_1.getAuthUser)(req);
        const orderId = req.params.id;
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                buyer: { select: { username: true, email: true } },
                event: { select: { name: true, location: true, date: true, time: true } },
                orderItems: { include: { ticketType: { select: { name: true } } } },
                payment: true,
                tickets: { select: { id: true, qrCode: true, status: true } },
            },
        });
        if (!order) {
            res.status(404).json({ message: "Order tidak ditemukan." });
            return;
        }
        if (authUser.role === "BUYER" && order.buyerId !== authUser.userId) {
            res.status(403).json({ message: "Anda tidak memiliki akses ke order ini." });
            return;
        }
        res.json(order);
    }
    catch (err) {
        next(err);
    }
});
// =========================================================
// CANCEL ORDER
// =========================================================
router.patch("/:id/cancel", auth_1.authenticate, (0, auth_1.authorize)("BUYER"), async (req, res, next) => {
    try {
        const authUser = (0, auth_1.getAuthUser)(req);
        const orderId = req.params.id;
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { orderItems: true },
        });
        if (!order) {
            res.status(404).json({ message: "Order tidak ditemukan." });
            return;
        }
        if (order.buyerId !== authUser.userId) {
            res.status(403).json({ message: "Anda tidak memiliki akses." });
            return;
        }
        if (order.status !== "PENDING") {
            res.status(400).json({ message: "Hanya order PENDING yang dapat dibatalkan." });
            return;
        }
        await prisma.$transaction(async (tx) => {
            for (const item of order.orderItems) {
                await tx.ticketType.update({
                    where: { id: item.ticketTypeId },
                    data: { quantitySold: { decrement: item.quantity } },
                });
            }
            await tx.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
            await tx.payment.updateMany({ where: { orderId: order.id }, data: { status: "CANCELLED" } });
        });
        res.json({ message: "Order berhasil dibatalkan." });
    }
    catch (err) {
        next(err);
    }
});
//# sourceMappingURL=order.routes.js.map