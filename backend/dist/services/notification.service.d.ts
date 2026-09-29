export declare class NotificationService {
    static create(data: {
        userId: string;
        title: string;
        message: string;
        type?: string;
        entityId?: string;
        entityType?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        title: string;
        message: string;
        type: string | null;
        read: boolean;
        entityId: string | null;
        entityType: string | null;
    }>;
    static getByUser(userId: string, unreadOnly?: boolean): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        title: string;
        message: string;
        type: string | null;
        read: boolean;
        entityId: string | null;
        entityType: string | null;
    }[]>;
    static markAsRead(id: string, userId: string): Promise<import(".prisma/client").Prisma.BatchPayload>;
    static markAllAsRead(userId: string): Promise<import(".prisma/client").Prisma.BatchPayload>;
    static getUnreadCount(userId: string): Promise<number>;
    static notifyAdmins(data: {
        title: string;
        message: string;
        type?: string;
        entityId?: string;
        entityType?: string;
    }): Promise<void>;
}
//# sourceMappingURL=notification.service.d.ts.map