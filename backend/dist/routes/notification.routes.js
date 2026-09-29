"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationRouter = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const notification_service_1 = require("../services/notification.service");
const router = (0, express_1.Router)();
exports.notificationRouter = router;
const prisma = new client_1.PrismaClient();
router.use(auth_1.authenticate);
router.get("/", async (req, res, next) => {
    try {
        const authUser = (0, auth_1.getAuthUser)(req);
        const notifications = await notification_service_1.NotificationService.getByUser(authUser.userId);
        const unreadCount = await notification_service_1.NotificationService.getUnreadCount(authUser.userId);
        res.json({ notifications, unreadCount });
    }
    catch (err) {
        next(err);
    }
});
router.patch("/:id/read", async (req, res, next) => {
    try {
        const authUser = (0, auth_1.getAuthUser)(req);
        const notifId = req.params.id;
        await notification_service_1.NotificationService.markAsRead(notifId, authUser.userId);
        res.json({ message: "Notifikasi ditandai sudah dibaca." });
    }
    catch (err) {
        next(err);
    }
});
router.patch("/read-all", async (req, res, next) => {
    try {
        const authUser = (0, auth_1.getAuthUser)(req);
        await notification_service_1.NotificationService.markAllAsRead(authUser.userId);
        res.json({ message: "Semua notifikasi ditandai sudah dibaca." });
    }
    catch (err) {
        next(err);
    }
});
//# sourceMappingURL=notification.routes.js.map