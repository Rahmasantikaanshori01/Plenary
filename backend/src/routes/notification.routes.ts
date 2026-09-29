import { Router, Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate, getAuthUser } from "../middleware/auth";
import { NotificationService } from "../services/notification.service";

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate);

router.get("/", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authUser = getAuthUser(req);
    const notifications = await NotificationService.getByUser(authUser.userId);
    const unreadCount = await NotificationService.getUnreadCount(authUser.userId);
    res.json({ notifications, unreadCount });
  } catch (err) { next(err); }
});

router.patch("/:id/read", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authUser = getAuthUser(req);
    const notifId = req.params.id as string;
    await NotificationService.markAsRead(notifId, authUser.userId);
    res.json({ message: "Notifikasi ditandai sudah dibaca." });
  } catch (err) { next(err); }
});

router.patch("/read-all", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authUser = getAuthUser(req);
    await NotificationService.markAllAsRead(authUser.userId);
    res.json({ message: "Semua notifikasi ditandai sudah dibaca." });
  } catch (err) { next(err); }
});

export { router as notificationRouter };
