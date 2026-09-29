import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export class NotificationService {
  static async create(data: {
    userId: string;
    title: string;
    message: string;
    type?: string;
    entityId?: string;
    entityType?: string;
  }) {
    return prisma.notification.create({ data });
  }

  static async getByUser(userId: string, unreadOnly = false) {
    return prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { read: false } : {}) },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  static async markAsRead(id: string, userId: string) {
    return prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });
  }

  static async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  static async getUnreadCount(userId: string) {
    return prisma.notification.count({
      where: { userId, read: false },
    });
  }

  // Notify all admins
  static async notifyAdmins(data: { title: string; message: string; type?: string; entityId?: string; entityType?: string }) {
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
