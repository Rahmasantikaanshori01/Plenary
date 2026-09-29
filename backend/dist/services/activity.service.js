"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityLogService = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
class ActivityLogService {
    static async log(data) {
        return prisma.activityLog.create({
            data: {
                userId: data.userId,
                action: data.action,
                entity: data.entity,
                entityId: data.entityId,
                ipAddress: data.ipAddress,
                metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
                details: data.details,
            },
        });
    }
    static async getByUser(userId, limit = 50) {
        return prisma.activityLog.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: limit,
        });
    }
    static async getAll(options = {}) {
        const { action, limit = 50, offset = 0 } = options;
        return prisma.activityLog.findMany({
            where: action ? { action } : undefined,
            include: { user: { select: { id: true, username: true, email: true, role: true } } },
            orderBy: { createdAt: "desc" },
            take: limit,
            skip: offset,
        });
    }
}
exports.ActivityLogService = ActivityLogService;
//# sourceMappingURL=activity.service.js.map