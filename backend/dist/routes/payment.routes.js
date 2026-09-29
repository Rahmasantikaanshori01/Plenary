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
exports.paymentRouter = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const payment_service_1 = require("../services/payment.service");
const notification_service_1 = require("../services/notification.service");
const uuid_1 = require("uuid");
const crypto = __importStar(require("crypto"));
const router = (0, express_1.Router)();
exports.paymentRouter = router;
const prisma = new client_1.PrismaClient();
// =========================================================
// PAYMENT WEBHOOK
// =========================================================
router.post("/webhook", async (req, res, next) => {
    try {
        const result = await payment_service_1.PaymentService.handleWebhook(req.body, req.headers);
        if (!result.valid || !result.orderId) {
            res.status(400).json({ message: "Invalid webhook." });
            return;
        }
        const order = await prisma.order.findUnique({
            where: { id: result.orderId },
            include: { orderItems: { include: { ticketType: true } }, event: true, payment: true },
        });
        if (!order) {
            res.status(404).json({ message: "Order not found." });
            return;
        }
        if (result.status === "PAID" && order.status !== "PAID") {
            await prisma.$transaction(async (tx) => {
                await tx.order.update({ where: { id: order.id }, data: { status: "PAID" } });
                await tx.payment.update({
                    where: { orderId: order.id },
                    data: { status: "PAID", transactionId: result.transactionId },
                });
                // Generate tickets
                for (const item of order.orderItems) {
                    for (let i = 0; i < item.quantity; i++) {
                        const qrToken = crypto.randomBytes(32).toString("hex");
                        const qrCode = `PLN-${(0, uuid_1.v4)().replace(/-/g, "").substring(0, 12).toUpperCase()}`;
                        await tx.ticket.create({
                            data: {
                                orderId: order.id,
                                buyerId: order.buyerId,
                                eventId: order.eventId,
                                ticketTypeId: item.ticketTypeId,
                                qrCode,
                                qrToken,
                            },
                        });
                    }
                }
                // Award loyalty points
                const points = Math.floor(order.totalAmount / 10000);
                if (points > 0) {
                    await tx.user.update({
                        where: { id: order.buyerId },
                        data: { loyaltyPoints: { increment: points } },
                    });
                    await tx.loyaltyTransaction.create({
                        data: { userId: order.buyerId, points, reason: "purchase", orderId: order.id },
                    });
                }
            });
            await notification_service_1.NotificationService.create({
                userId: order.buyerId,
                title: "Pembayaran Berhasil! 🎉",
                message: `Pembayaran untuk "${order.event.name}" berhasil. Tiket Anda sudah tersedia.`,
                type: "PAYMENT_UPDATE",
                entityId: order.id,
                entityType: "order",
            });
        }
        else if (result.status && ["FAILED", "EXPIRED", "CANCELLED"].includes(result.status)) {
            await prisma.$transaction(async (tx) => {
                for (const item of order.orderItems) {
                    await tx.ticketType.update({
                        where: { id: item.ticketTypeId },
                        data: { quantitySold: { decrement: item.quantity } },
                    });
                }
                await tx.order.update({ where: { id: order.id }, data: { status: result.status } });
                await tx.payment.update({ where: { orderId: order.id }, data: { status: result.status } });
            });
        }
        res.json({ message: "Webhook processed." });
    }
    catch (err) {
        next(err);
    }
});
// =========================================================
// CHECK PAYMENT STATUS
// =========================================================
router.get("/:orderId/status", async (req, res, next) => {
    try {
        const orderId = req.params.orderId;
        const payment = await prisma.payment.findUnique({
            where: { orderId },
            select: { status: true, transactionId: true, amount: true, method: true, createdAt: true },
        });
        if (!payment) {
            res.status(404).json({ message: "Payment tidak ditemukan." });
            return;
        }
        res.json(payment);
    }
    catch (err) {
        next(err);
    }
});
//# sourceMappingURL=payment.routes.js.map