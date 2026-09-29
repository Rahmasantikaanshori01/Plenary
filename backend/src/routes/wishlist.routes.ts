import { Router, Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate, authorize, getAuthUser } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// GET /api/wishlist — Get buyer's wishlist
router.get("/", authenticate, authorize("BUYER"), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authUser = getAuthUser(req);
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
  } catch (err) {
    next(err);
  }
});

// POST /api/wishlist/:eventId — Toggle wishlist
router.post("/:eventId", authenticate, authorize("BUYER"), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authUser = getAuthUser(req);
    const eventId = req.params.eventId as string;
    const buyerId = authUser.userId;

    const existing = await prisma.wishlist.findUnique({
      where: { buyerId_eventId: { buyerId, eventId } },
    });

    if (existing) {
      await prisma.wishlist.delete({ where: { id: existing.id } });
      res.json({ message: "Event dihapus dari wishlist.", saved: false });
    } else {
      await prisma.wishlist.create({ data: { buyerId, eventId } });
      res.json({ message: "Event disimpan ke wishlist.", saved: true });
    }
  } catch (err) {
    next(err);
  }
});

export { router as wishlistRouter };
