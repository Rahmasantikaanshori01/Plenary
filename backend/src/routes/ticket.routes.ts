import { Router, Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import QRCode from "qrcode";
import { authenticate, authorize, getAuthUser } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// =========================================================
// GET QR CODE IMAGE DATA URL
// =========================================================

router.get("/qr-image/:qrToken", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const qrToken = req.params.qrToken as string;
    const ticket = await prisma.ticket.findUnique({
      where: { qrToken },
      select: { ticketCode: true, qrCode: true, qrToken: true, status: true },
    });
    if (!ticket) {
      res.status(404).json({ message: "Tiket tidak ditemukan." });
      return;
    }
    const dataUrl = await QRCode.toDataURL(ticket.qrToken, { width: 300, margin: 2 });
    res.json({ dataUrl, ticketCode: ticket.ticketCode, qrCode: ticket.qrCode, status: ticket.status });
  } catch (err) { next(err); }
});

// =========================================================
// GET BUYER'S TICKETS
// =========================================================

router.get("/my-tickets", authenticate, authorize("BUYER"), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authUser = getAuthUser(req);
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
  } catch (err) { next(err); }
});

// =========================================================
// VALIDATE QR CODE
// =========================================================

router.get("/validate/:qrToken", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const qrToken = req.params.qrToken as string;
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

    if (ticket.status === "USED") {
      res.json({ valid: false, message: "Tiket sudah digunakan.", ticket: { id: ticket.id, ticketCode: ticket.ticketCode, status: ticket.status } });
      return;
    }
    if (ticket.status === "CANCELLED") {
      res.json({ valid: false, message: "Tiket telah dibatalkan.", ticket: { id: ticket.id, ticketCode: ticket.ticketCode, status: ticket.status } });
      return;
    }
    if (ticket.status === "EXPIRED") {
      res.json({ valid: false, message: "Tiket sudah expired.", ticket: { id: ticket.id, ticketCode: ticket.ticketCode, status: ticket.status } });
      return;
    }

    if (ticket.event && ticket.event.status === "CANCELLED") {
      res.json({ valid: false, message: "Event telah dibatalkan." });
      return;
    }

    res.json({
      valid: true,
      message: "Tiket valid!",
      ticket: {
        id: ticket.id,
        ticketCode: ticket.ticketCode,
        status: ticket.status,
        qrCode: ticket.qrCode,
        event: ticket.event,
        ticketType: ticket.ticketType,
        buyer: ticket.buyer,
      },
    });
  } catch (err) { next(err); }
});

// =========================================================
// USE TICKET (mark as USED)
// =========================================================

router.post("/use/:qrToken", authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const qrToken = req.params.qrToken as string;
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

    res.json({ message: "Tiket berhasil divalidasi! ✅", ticketId: ticket.id, ticketCode: ticket.ticketCode });
  } catch (err) { next(err); }
});

export { router as ticketRouter };
