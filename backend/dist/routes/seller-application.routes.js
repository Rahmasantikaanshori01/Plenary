"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sellerApplicationRouter = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const notification_service_1 = require("../services/notification.service");
const router = (0, express_1.Router)();
exports.sellerApplicationRouter = router;
const prisma = new client_1.PrismaClient();
// =========================================================
// SUBMIT SELLER APPLICATION (Public)
// =========================================================
router.post("/", async (req, res, next) => {
    try {
        const { nik, ownerName, age, birthDate, gender, storeName, storeDescription, storeAddress, storeEmail, organizationName, organizationType, channel, } = req.body;
        // Validation
        if (!nik || !ownerName || !age || !birthDate || !gender || !storeName || !storeAddress || !storeEmail) {
            res.status(400).json({ message: "Semua field wajib diisi." });
            return;
        }
        if (nik.length !== 16 || !/^\d+$/.test(nik)) {
            res.status(400).json({ message: "NIK harus 16 digit angka." });
            return;
        }
        // Check if email already used
        const existingApp = await prisma.sellerApplication.findFirst({
            where: { storeEmail, status: "PENDING" },
        });
        if (existingApp) {
            res.status(409).json({ message: "Email ini sudah memiliki aplikasi yang sedang diproses." });
            return;
        }
        const application = await prisma.sellerApplication.create({
            data: {
                nik,
                ownerName,
                age: parseInt(age, 10),
                birthDate: new Date(birthDate),
                gender,
                storeName,
                storeDescription: storeDescription || null,
                storeAddress,
                storeEmail,
                organizationName: organizationName || null,
                organizationType: organizationType || null,
                channel: channel || "web",
            },
        });
        // Notify admins
        await notification_service_1.NotificationService.notifyAdmins({
            title: "Aplikasi Seller Baru",
            message: `${ownerName} mengajukan aplikasi seller untuk "${storeName}".`,
            type: "SELLER_APPLICATION",
            entityId: application.id,
            entityType: "seller_application",
        });
        res.status(201).json({
            message: "Aplikasi seller berhasil dikirim! Anda akan dihubungi oleh Admin.",
            applicationId: application.id,
        });
    }
    catch (err) {
        next(err);
    }
});
// =========================================================
// CHECK APPLICATION STATUS (Public, by email)
// =========================================================
router.get("/status", async (req, res, next) => {
    try {
        const email = req.query.email;
        if (!email) {
            res.status(400).json({ message: "Email diperlukan." });
            return;
        }
        const application = await prisma.sellerApplication.findFirst({
            where: { storeEmail: email },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                storeName: true,
                status: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        if (!application) {
            res.status(404).json({ message: "Tidak ditemukan aplikasi dengan email tersebut." });
            return;
        }
        res.json(application);
    }
    catch (err) {
        next(err);
    }
});
//# sourceMappingURL=seller-application.routes.js.map