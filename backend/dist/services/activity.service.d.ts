export declare class ActivityLogService {
    static log(data: {
        userId: string;
        action: string;
        entity?: string;
        entityId?: string;
        ipAddress?: string;
        metadata?: Record<string, unknown>;
        details?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        entityId: string | null;
        action: string;
        entity: string | null;
        ipAddress: string | null;
        metadata: string | null;
        details: string | null;
    }>;
    static getByUser(userId: string, limit?: number): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        entityId: string | null;
        action: string;
        entity: string | null;
        ipAddress: string | null;
        metadata: string | null;
        details: string | null;
    }[]>;
    static getAll(options?: {
        action?: string;
        limit?: number;
        offset?: number;
    }): Promise<({
        user: {
            id: string;
            username: string | null;
            email: string | null;
            role: import(".prisma/client").$Enums.Role;
        };
    } & {
        id: string;
        createdAt: Date;
        userId: string;
        entityId: string | null;
        action: string;
        entity: string | null;
        ipAddress: string | null;
        metadata: string | null;
        details: string | null;
    })[]>;
}
//# sourceMappingURL=activity.service.d.ts.map