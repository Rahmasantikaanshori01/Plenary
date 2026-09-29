import { Router, Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate, authorize, getAuthUser } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// GET /api/events — List events (public)
router.get("/", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const category = req.query.category as string | undefined;
    const search = req.query.search as string | undefined;
    const page = parseInt((req.query.page as string) || "1", 10);
    const limit = parseInt((req.query.limit as string) || "12", 10);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { status: { in: ["ACTIVE", "PUBLISHED"] } };
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
  } catch (err) {
    next(err);
  }
});

// GET /api/events/:id — Event detail (public)
router.get("/:id", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id as string },
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
  } catch (err) {
    next(err);
  }
});

// POST /api/events — Create event (seller only)
router.post("/", authenticate, authorize("SELLER"), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authUser = getAuthUser(req);
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
          create: (ticketTypes || []).map((t: { name: string; price: number; quantity: number }) => ({
            name: t.name,
            price: t.price,
            quantity: t.quantity,
          })),
        },
      },
      include: { ticketTypes: true },
    });

    res.status(201).json(event);
  } catch (err) {
    next(err);
  }
});

export { router as eventRouter };
