"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
class NotificationService {
    static async create(data) {
        return prisma.notification.create({ data });
    }
    static async getByUser(userId, unreadOnly = false) {
        return prisma.notification.findMany({
            where: { userId, ...(unreadOnly ? { read: false } : {}) },
            orderBy: { createdAt: "desc" },
            take: 50,
        });
    }
    static async markAsRead(id, userId) {
        return prisma.notification.updateMany({
            where: { id, userId },
            data: { read: true },
        });
    }
    static async markAllAsRead(userId) {
        return prisma.notification.updateMany({
            where: { userId, read: false },
            data: { read: true },
        });
    }
    static async getUnreadCount(userId) {
        return prisma.notification.count({
            where: { userId, read: false },
        });
    }
    // Notify all admins
    static async notifyAdmins(data) {
        const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
        const notifications = admins.map((admin) => ({
            userId: admin.id,
            ...data,
        }));
        if (notifications.length > 0) {
            await prisma.notification.createMany({ data: notifications });
        }
    }
}
exports.NotificationService = NotificationService;
//# sourceMappingURL=notification.service.js.map