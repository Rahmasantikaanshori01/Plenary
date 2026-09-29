"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const auth_1 = require("../middleware/auth");
const hash_1 = require("../utils/hash");
const notification_service_1 = require("../services/notification.service");
const activity_service_1 = require("../services/activity.service");
const email_service_1 = require("../services/email.service");
const router = (0, express_1.Router)();
exports.adminRouter = router;
const prisma = new client_1.PrismaClient();
// All admin routes require ADMIN role
router.use(auth_1.authenticate, (0, auth_1.authorize)("ADMIN"));
// =========================================================
// DASHBOARD STATS
// =========================================================
router.get("/stats", async (req, res, next) => {
    try {
        const [totalBuyers, totalSellers, totalStaff, totalEvents, activeEvents, completedEvents, activeTickets, soldTickets, totalOrders, totalRevenue, pendingVerifications,] = await Promise.all([
            prisma.user.count({ where: { role: "BUYER" } }),
            prisma.user.count({ where: { role: "SELLER" } }),
            prisma.user.count({ where: { role: "STAFF" } }),
            prisma.event.count(),
            prisma.event.count({ where: { status: "ACTIVE" } }),
            prisma.event.count({ where: { status: "COMPLETED" } }),
            prisma.ticket.count({ where: { status: "ACTIVE" } }),
            prisma.ticket.count({ where: { status: "USED" } }),
            prisma.order.count(),
            prisma.payment.aggregate({ _sum: { amount: true }, where: { status: "PAID" } }),
            prisma.sellerApplication.count({ where: { status: "PENDING" } }),
        ]);
        res.json({
            totalBuyers,
            totalSellers,
            totalStaff,
            totalEvents,
            activeEvents,
            completedEvents,
            activeTickets,
            soldTickets,
            totalOrders,
            totalRevenue: totalRevenue._sum.amount || 0,
            pendingVerifications,
        });
    }
    catch (err) {
        next(err);
    }
});
// =========================================================
// SELLER APPLICATIONS
// =========================================================
router.get("/seller-applications", async (req, res, next) => {
    try {
        const status = req.query.status;
        const page = parseInt(req.query.page || "1", 10);
        const limit = parseInt(req.query.limit || "20", 10);
        const where = status ? { status: status } : {};
        const [applications, total] = await Promise.all([
            prisma.sellerApplication.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.sellerApplication.count({ where }),
        ]);
        res.json({ applications, total, page, totalPages: Math.ceil(total / limit) });
    }
    catch (err) {
        next(err);
    }
});
router.get("/seller-applications/:id", async (req, res, next) => {
    try {
        const applicationId = req.params.id;
        const application = await prisma.sellerApplication.findUnique({
            where: { id: applicationId },
        });
        if (!application) {
            res.status(404).json({ message: "Aplikasi seller tidak ditemukan." });
            return;
        }
        res.json(application);
    }
    catch (err) {
        next(err);
    }
});
// =========================================================
// APPROVE SELLER
// =========================================================
router.post("/seller-applications/:id/approve", async (req, res, next) => {
    try {
        const authUser = (0, auth_1.getAuthUser)(req);
        const applicationId = req.params.id;
        const application = await prisma.sellerApplication.findUnique({
            where: { id: applicationId },
        });
        if (!application) {
            res.status(404).json({ message: "Aplikasi seller tidak ditemukan." });
            return;
        }
        if (application.status !== "PENDING") {
            res.status(400).json({ message: "Aplikasi ini sudah diproses." });
            return;
        }
        // Generate unique account code: PLN-XXXX-XXXX
        const generateAccountCode = () => {
            const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
            const part1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
            const part2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
            return `PLN-${part1}-${part2}`;
        };
        let accountCode = generateAccountCode();
        // Ensure uniqueness
        while (await prisma.sellerProfile.findUnique({ where: { accountCode } })) {
            accountCode = generateAccountCode();
        }
        // Generate store email: firstName@plenary.id
        const domain = process.env.PLENARY_DOMAIN || "plenary.id";
        let emailUsername = application.ownerName.split(" ")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
        let storeEmail = `${emailUsername}@${domain}`;
        let counter = 1;
        while (await prisma.sellerProfile.findUnique({ where: { storeEmail } })) {
            storeEmail = `${emailUsername}${String(counter).padStart(2, "0")}@${domain}`;
            counter++;
        }
        // Generate temporary password: lastName + approvedNumber + "plenary"
        const nameParts = application.ownerName.split(" ");
        const lastName = nameParts[nameParts.length - 1].toLowerCase();
        const approvedCount = await prisma.sellerProfile.count();
        const tempPassword = `${lastName}${String(approvedCount + 1).padStart(2, "0")}plenary`;
        const hashedPassword = await (0, hash_1.hashPassword)(tempPassword);
        // Transaction: create user, seller profile, update application
        const result = await prisma.$transaction(async (tx) => {
            // Create User with SELLER role
            const user = await tx.user.create({
                data: {
                    nik: application.nik,
                    email: storeEmail,
                    username: application.ownerName.replace(/\s+/g, "").toLowerCase(),
                    password: hashedPassword,
                    role: "SELLER",
                    age: application.age,
                    birthDate: application.birthDate,
                    gender: application.gender,
                    mustChangePassword: true,
                },
            });
            // Create SellerProfile
            const sellerProfile = await tx.sellerProfile.create({
                data: {
                    userId: user.id,
                    storeName: application.storeName,
                    storeDescription: application.storeDescription,
                    storeAddress: application.storeAddress,
                    storeEmail,
                    accountCode,
                    organizationName: application.organizationName,
                    organizationType: application.organizationType,
                },
            });
            // Create SellerVerification record
            await tx.sellerVerification.create({
                data: {
                    userId: user.id,
                    nik: application.nik,
                    ownerName: application.ownerName,
                    age: application.age,
                    birthDate: application.birthDate,
                    gender: application.gender,
                    storeName: application.storeName,
                    storeDescription: application.storeDescription,
                    storeAddress: application.storeAddress,
                    storeEmail,
                    status: "APPROVED",
                    organizationName: application.organizationName,
                    organizationType: application.organizationType,
                    applicationId: application.id,
                },
            });
            // Update application status
            await tx.sellerApplication.update({
                where: { id: application.id },
                data: { status: "APPROVED", adminNotes: req.body.notes || null },
            });
            return { user, sellerProfile };
        });
        // Send approval email
        await email_service_1.EmailService.sendSellerApproval({
            to: application.storeEmail,
            ownerName: application.ownerName,
            storeName: application.storeName,
            storeEmail,
            temporaryPassword: tempPassword,
            accountCode,
        });
        // Log activity
        await activity_service_1.ActivityLogService.log({
            userId: authUser.userId,
            action: "SELLER_APPROVAL",
            entity: "seller_application",
            entityId: application.id,
            details: `Approved seller: ${application.storeName}`,
        });
        res.json({
            message: "Seller berhasil disetujui!",
            seller: {
                userId: result.user.id,
                storeEmail,
                accountCode,
                storeName: result.sellerProfile.storeName,
            },
        });
    }
    catch (err) {
        next(err);
    }
});
// =========================================================
// REJECT SELLER
// =========================================================
router.post("/seller-applications/:id/reject", async (req, res, next) => {
    try {
        const authUser = (0, auth_1.getAuthUser)(req);
        const { reason } = req.body;
        const applicationId = req.params.id;
        const application = await prisma.sellerApplication.findUnique({
            where: { id: applicationId },
        });
        if (!application) {
            res.status(404).json({ message: "Aplikasi seller tidak ditemukan." });
            return;
        }
        if (application.status !== "PENDING") {
            res.status(400).json({ message: "Aplikasi ini sudah diproses." });
            return;
        }
        await prisma.sellerApplication.update({
            where: { id: application.id },
            data: { status: "REJECTED", adminNotes: reason || null },
        });
        // Send rejection email
        await email_service_1.EmailService.sendSellerRejection({
            to: application.storeEmail,
            ownerName: application.ownerName,
            storeName: application.storeName,
            reason,
        });
        await activity_service_1.ActivityLogService.log({
            userId: authUser.userId,
            action: "SELLER_REJECTION",
            entity: "seller_application",
            entityId: application.id,
            details: `Rejected seller: ${application.storeName}. Reason: ${reason || "No reason provided"}`,
        });
        res.json({ message: "Aplikasi seller ditolak." });
    }
    catch (err) {
        next(err);
    }
});
// =========================================================
// USERS MANAGEMENT
// =========================================================
router.get("/users", async (req, res, next) => {
    try {
        const role = req.query.role;
        const page = parseInt(req.query.page || "1", 10);
        const limit = parseInt(req.query.limit || "20", 10);
        const where = role ? { role: role } : {};
        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                select: {
                    id: true, nik: true, username: true, email: true, role: true,
                    age: true, birthDate: true, gender: true, loyaltyPoints: true,
                    createdAt: true, updatedAt: true,
                    sellerProfile: { select: { storeName: true, accountCode: true, storeEmail: true } },
                },
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.user.count({ where }),
        ]);
        res.json({ users, total, page, totalPages: Math.ceil(total / limit) });
    }
    catch (err) {
        next(err);
    }
});
// =========================================================
// EVENTS MANAGEMENT
// =========================================================
router.get("/events", async (req, res, next) => {
    try {
        const page = parseInt(req.query.page || "1", 10);
        const limit = parseInt(req.query.limit || "20", 10);
        const [events, total] = await Promise.all([
            prisma.event.findMany({
                include: {
                    seller: { select: { storeName: true } },
                    ticketTypes: true,
                    _count: { select: { orders: true, tickets: true } },
                },
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.event.count(),
        ]);
        res.json({ events, total, page, totalPages: Math.ceil(total / limit) });
    }
    catch (err) {
        next(err);
    }
});
// =========================================================
// ORDERS MANAGEMENT
// =========================================================
router.get("/orders", async (req, res, next) => {
    try {
        const page = parseInt(req.query.page || "1", 10);
        const limit = parseInt(req.query.limit || "20", 10);
        const status = req.query.status;
        const where = status ? { status: status } : {};
        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where,
                include: {
                    buyer: { select: { username: true, email: true } },
                    event: { select: { name: true } },
                    payment: { select: { status: true, method: true } },
                    _count: { select: { tickets: true } },
                },
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.order.count({ where }),
        ]);
        res.json({ orders, total, page, totalPages: Math.ceil(total / limit) });
    }
    catch (err) {
        next(err);
    }
});
// =========================================================
// MESSAGES
// =========================================================
router.get("/messages", async (req, res, next) => {
    try {
        const channel = req.query.channel;
        const page = parseInt(req.query.page || "1", 10);
        const limit = parseInt(req.query.limit || "20", 10);
        const where = channel ? { channel } : {};
        const [messages, total] = await Promise.all([
            prisma.sellerMessage.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.sellerMessage.count({ where }),
        ]);
        res.json({ messages, total, page, totalPages: Math.ceil(total / limit) });
    }
    catch (err) {
        next(err);
    }
});
router.patch("/messages/:id/read", async (req, res, next) => {
    try {
        const messageId = req.params.id;
        await prisma.sellerMessage.update({
            where: { id: messageId },
            data: { read: true },
        });
        res.json({ message: "Pesan ditandai sudah dibaca." });
    }
    catch (err) {
        next(err);
    }
});
// =========================================================
// NOTIFICATIONS
// =========================================================
router.get("/notifications", async (req, res, next) => {
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
// =========================================================
// ACTIVITY LOGS
// =========================================================
router.get("/activity-logs", async (req, res, next) => {
    try {
        const page = parseInt(req.query.page || "1", 10);
        const limit = parseInt(req.query.limit || "50", 10);
        const logs = await activity_service_1.ActivityLogService.getAll({ limit, offset: (page - 1) * limit });
        res.json({ logs });
    }
    catch (err) {
        next(err);
    }
});
//# sourceMappingURL=admin.routes.js.map