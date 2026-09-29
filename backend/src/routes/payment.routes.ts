import { Router, Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { PaymentService } from "../services/payment.service";
import { NotificationService } from "../services/notification.service";
import { ActivityLogService } from "../services/activity.service";
import { v4 as uuidv4 } from "uuid";
import * as crypto from "crypto";

const router = Router();
const prisma = new PrismaClient();

// =========================================================
// PAYMENT WEBHOOK
// =========================================================

router.post("/webhook", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await PaymentService.handleWebhook(req.body, req.headers as Record<string, string>);

    if (!result.valid || !result.orderId) {
      res.status(400).json({ message: "Invalid webhook." });
      return;
    }

    const order = await prisma.order.findUnique({
      where: { id: result.orderId },
      include: { orderItems: { include: { ticketType: true } }, event: true, payment: true },
    });

    if (!order) { res.status(404).json({ message: "Order not found." }); return; }

    if (result.status === "PAID" && order.status !== "PAID") {
      await prisma.$transaction(async (tx) => {
        await tx.order.update({ where: { id: order.id }, data: { status: "PAID" } });
        await tx.payment.update({
          where: { orderId: order.id },
          data: { status: "PAID", transactionId: result.transactionId, paidAt: new Date() },
        });

        // Generate tickets
        for (const item of order.orderItems) {
          for (let i = 0; i < item.quantity; i++) {
            const qrToken = crypto.randomBytes(32).toString("hex");
            const ticketCode = `PLN-${uuidv4().replace(/-/g, "").substring(0, 12).toUpperCase()}`;
            const qrCode = `PLENARY-${uuidv4().replace(/-/g, "").substring(0, 16).toUpperCase()}`;

            await tx.ticket.create({
              data: {
                ticketCode,
                qrCode,
                qrToken,
                orderId: order.id,
                orderItemId: item.id,
                buyerId: order.buyerId,
                sellerId: order.sellerId,
                eventId: order.eventId,
                ticketTypeId: item.ticketTypeId,
              },
            });
          }
        }

        // Award loyalty points (1 point per Rp 10.000)
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

      await NotificationService.create({
        userId: order.buyerId,
        title: "Pembayaran Berhasil! 🎉",
        message: `Pembayaran untuk "${order.event.name}" berhasil. Tiket Anda sudah tersedia di My Tickets.`,
        type: "PAYMENT_UPDATE",
        entityId: order.id,
        entityType: "order",
      });
    } else if (result.status && ["FAILED", "EXPIRED", "CANCELLED"].includes(result.status)) {
      await prisma.$transaction(async (tx) => {
        for (const item of order.orderItems) {
          await tx.ticketType.update({
            where: { id: item.ticketTypeId },
            data: { quantitySold: { decrement: item.quantity } },
          });
        }
        await tx.order.update({ where: { id: order.id }, data: { status: result.status! } });
        await tx.payment.update({ where: { orderId: order.id }, data: { status: result.status! } });
      });

      await NotificationService.create({
        userId: order.buyerId,
        title: "Pembayaran Gagal",
        message: `Pembayaran untuk "${order.event.name}" ${result.status === "EXPIRED" ? "telah kedaluwarsa" : "gagal"}. Stok tiket telah dikembalikan.`,
        type: "PAYMENT_UPDATE",
        entityId: order.id,
        entityType: "order",
      });
    }

    res.json({ message: "Webhook processed." });
  } catch (err) { next(err); }
});

// =========================================================
// SIMULATE PAYMENT (Development only)
// =========================================================

router.post("/simulate/:orderId", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (process.env.NODE_ENV === "production") {
      res.status(403).json({ message: "Simulate payment tidak tersedia di production." });
      return;
    }

    const orderId = String(req.params.orderId);
    const { action } = req.body; // "pay" | "fail" | "expire"

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { orderItems: { include: { ticketType: true } }, event: true },
    }) as any;

    if (!order) { res.status(404).json({ message: "Order tidak ditemukan." }); return; }
    if (order.status !== "PENDING") { res.status(400).json({ message: "Order bukan PENDING." }); return; }

    if (action === "pay") {
      await prisma.$transaction(async (tx) => {
        await tx.order.update({ where: { id: order.id }, data: { status: "PAID" } });
        await tx.payment.update({
          where: { orderId: order.id },
          data: { status: "PAID", transactionId: `SIM-${Date.now()}`, paidAt: new Date() },
        });

        for (const item of order.orderItems) {
          for (let i = 0; i < item.quantity; i++) {
            const qrToken = crypto.randomBytes(32).toString("hex");
            const ticketCode = `PLN-${uuidv4().replace(/-/g, "").substring(0, 12).toUpperCase()}`;
            const qrCode = `PLENARY-${uuidv4().replace(/-/g, "").substring(0, 16).toUpperCase()}`;

            await tx.ticket.create({
              data: {
                ticketCode, qrCode, qrToken,
                orderId: order.id, orderItemId: item.id,
                buyerId: order.buyerId, sellerId: order.sellerId,
                eventId: order.eventId, ticketTypeId: item.ticketTypeId,
              },
            });
          }
        }

        const points = Math.floor(order.totalAmount / 10000);
        if (points > 0) {
          await tx.user.update({ where: { id: order.buyerId }, data: { loyaltyPoints: { increment: points } } });
          await tx.loyaltyTransaction.create({
            data: { userId: order.buyerId, points, reason: "purchase", orderId: order.id },
          });
        }
      });

      await NotificationService.create({
        userId: order.buyerId,
        title: "Pembayaran Berhasil! 🎉",
        message: `Pembayaran untuk "${order.event.name}" berhasil (simulasi). Tiket sudah tersedia.`,
        type: "PAYMENT_UPDATE",
        entityId: order.id,
        entityType: "order",
      });

      res.json({ message: "Payment simulated: PAID", status: "PAID" });
    } else {
      const status = action === "expire" ? "EXPIRED" : "FAILED";
      await prisma.$transaction(async (tx) => {
        for (const item of order.orderItems) {
          await tx.ticketType.update({
            where: { id: item.ticketTypeId },
            data: { quantitySold: { decrement: item.quantity } },
          });
        }
        await tx.order.update({ where: { id: order.id }, data: { status } });
        await tx.payment.update({ where: { orderId: order.id }, data: { status } });
      });

      res.json({ message: `Payment simulated: ${status}`, status });
    }
  } catch (err) { next(err); }
});

// =========================================================
// CHECK PAYMENT STATUS
// =========================================================

router.get("/:orderId/status", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orderId = req.params.orderId as string;
    const payment = await prisma.payment.findUnique({
      where: { orderId },
      select: { status: true, transactionId: true, amount: true, method: true, paidAt: true, createdAt: true },
    });

    if (!payment) { res.status(404).json({ message: "Payment tidak ditemukan." }); return; }
    res.json(payment);
  } catch (err) { next(err); }
});

export { router as paymentRouter };
