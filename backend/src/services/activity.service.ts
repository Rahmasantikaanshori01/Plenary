import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export class ActivityLogService {
  static async log(data: {
    userId: string;
    role?: string;
    action: string;
    entity?: string;
    entityId?: string;
    ipAddress?: string;
    metadata?: Record<string, unknown>;
    details?: string;
  }) {
    return prisma.activityLog.create({
      data: {
        userId: data.userId,
        role: data.role,
        action: data.action,
        entity: data.entity,
        entityId: data.entityId,
        ipAddress: data.ipAddress,
        metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
        details: data.details,
      },
    });
  }

  static async getByUser(userId: string, limit = 50) {
    return prisma.activityLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  static async getAll(options: { action?: string; limit?: number; offset?: number } = {}) {
    const { action, limit = 50, offset = 0 } = options;
    return prisma.activityLog.findMany({
      where: action ? { action } : undefined,
      include: { user: { select: { id: true, username: true, email: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });
  }

  static async count(options: { action?: string } = {}) {
    const { action } = options;
    return prisma.activityLog.count({
      where: action ? { action } : undefined,
    });
  }
}
