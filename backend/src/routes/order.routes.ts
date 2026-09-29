import { Router, Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate, authorize, getAuthUser } from "../middleware/auth";
import { PaymentService } from "../services/payment.service";
import { NotificationService } from "../services/notification.service";
import { ActivityLogService } from "../services/activity.service";

const router = Router();
const prisma = new PrismaClient();

// =========================================================
// CREATE ORDER (Buyer only)
// =========================================================

router.post("/", authenticate, authorize("BUYER"), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authUser = getAuthUser(req);
    const { eventId, items } = req.body;

    if (!eventId || !items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ message: "Event dan item tiket wajib diisi." });
      return;
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { ticketTypes: true, seller: { select: { id: true } } },
    });

    if (!event) { res.status(404).json({ message: "Event tidak ditemukan." }); return; }
    if (event.status !== "ACTIVE" && event.status !== "PUBLISHED") {
      res.status(400).json({ message: "Event tidak tersedia untuk pembelian." });
      return;
    }

    const now = new Date();
    if (now < event.saleStart) {
      res.status(400).json({ message: "Periode penjualan tiket belum dimulai." });
      return;
    }
    if (now > event.saleEnd) {
      res.status(400).json({ message: "Periode penjualan tiket sudah berakhir." });
      return;
    }
    if (now > event.date) {
      res.status(400).json({ message: "Event sudah berlalu." });
      return;
    }

    const order = await prisma.$transaction(async (tx) => {
      let totalAmount = 0;
      const orderItemsData: Array<{ eventId: string; ticketTypeId: string; sellerId: string; quantity: number; price: number; subtotal: number }> = [];

      for (const item of items as Array<{ ticketTypeId: string; quantity: number }>) {
        const ticketType = event.ticketTypes.find((t) => t.id === item.ticketTypeId);
        if (!ticketType) throw new Error(`Tipe tiket tidak ditemukan.`);

        const available = ticketType.quantity - ticketType.quantitySold;
        if (item.quantity > available) throw new Error(`Stok tiket "${ticketType.name}" tidak mencukupi. Tersisa ${available}.`);
        if (item.quantity <= 0) throw new Error(`Jumlah tiket harus lebih dari 0.`);

        // Backend determines price from DB — never trust frontend price
        const unitPrice = ticketType.price;
        const subtotal = unitPrice * item.quantity;

        await tx.ticketType.update({
          where: { id: item.ticketTypeId },
          data: { quantitySold: { increment: item.quantity } },
        });

        totalAmount += subtotal;
        orderItemsData.push({
          eventId: event.id,
          ticketTypeId: item.ticketTypeId,
          sellerId: event.seller.id,
          quantity: item.quantity,
          price: unitPrice,
          subtotal,
        });
      }

      const newOrder = await tx.order.create({
        data: {
          buyerId: authUser.userId,
          eventId,
          sellerId: event.seller.id,
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

    // Create payment with provider
    const paymentResult = await PaymentService.createPayment({
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

    // Create notification
    await NotificationService.create({
      userId: authUser.userId,
      title: "Pesanan Dibuat! 🎫",
      message: `Pesanan tiket untuk "${event.name}" berhasil dibuat. Silakan selesaikan pembayaran.`,
      type: "ORDER_UPDATE",
      entityId: order.id,
      entityType: "order",
    });

    // Log activity
    await ActivityLogService.log({
      userId: authUser.userId,
      role: "BUYER",
      action: "CREATE_ORDER",
      entity: "order",
      entityId: order.id,
      details: `Order created for event: ${event.name}, Total: ${order.totalAmount}`,
    });

    res.status(201).json({
      message: "Order berhasil dibuat.",
      order: { id: order.id, totalAmount: order.totalAmount, status: order.status },
      payment: { paymentUrl: paymentResult.paymentUrl, status: paymentResult.status },
    });
  } catch (err) {
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

router.get("/:id", authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authUser = getAuthUser(req);
    const orderId = req.params.id as string;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: { select: { username: true, email: true } },
        event: { select: { name: true, location: true, date: true, time: true, banner: true } },
        orderItems: { include: { ticketType: { select: { name: true } } } },
        payment: true,
        tickets: { select: { id: true, ticketCode: true, qrCode: true, qrToken: true, status: true } },
      },
    });

    if (!order) { res.status(404).json({ message: "Order tidak ditemukan." }); return; }

    // Buyer can only see their own orders
    if (authUser.role === "BUYER" && order.buyerId !== authUser.userId) {
      res.status(403).json({ message: "Anda tidak memiliki akses ke order ini." });
      return;
    }

    res.json(order);
  } catch (err) { next(err); }
});

// =========================================================
// CANCEL ORDER
// =========================================================

router.patch("/:id/cancel", authenticate, authorize("BUYER"), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authUser = getAuthUser(req);
    const orderId = req.params.id as string;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { orderItems: true },
    });

    if (!order) { res.status(404).json({ message: "Order tidak ditemukan." }); return; }
    if (order.buyerId !== authUser.userId) { res.status(403).json({ message: "Anda tidak memiliki akses." }); return; }
    if (order.status !== "PENDING") { res.status(400).json({ message: "Hanya order PENDING yang dapat dibatalkan." }); return; }

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

    await NotificationService.create({
      userId: authUser.userId,
      title: "Pesanan Dibatalkan",
      message: `Pesanan #${order.id.substring(0, 8)} telah dibatalkan.`,
      type: "ORDER_UPDATE",
      entityId: order.id,
      entityType: "order",
    });

    res.json({ message: "Order berhasil dibatalkan." });
  } catch (err) { next(err); }
});

export { router as orderRouter };
