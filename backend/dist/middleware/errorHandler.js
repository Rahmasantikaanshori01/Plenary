"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
function errorHandler(err, _req, res, _next) {
    console.error("[Error]", err.message);
    // Prisma errors
    if (err.constructor.name === "PrismaClientKnownRequestError") {
        const prismaErr = err;
        if (prismaErr.code === "P2002") {
            const field = prismaErr.meta?.target?.[0] || "field";
            res.status(409).json({ message: `${field} sudah digunakan.` });
            return;
        }
        if (prismaErr.code === "P2025") {
            res.status(404).json({ message: "Data tidak ditemukan." });
            return;
        }
    }
    // Validation errors
    if (err.message.includes("wajib") || err.message.includes("harus") || err.message.includes("tidak valid")) {
        res.status(400).json({ message: err.message });
        return;
    }
    // Don't expose stack traces in production
    if (process.env.NODE_ENV === "production") {
        res.status(500).json({ message: "Terjadi kesalahan pada server." });
    }
    else {
        res.status(500).json({ message: err.message || "Internal Server Error" });
    }
}
//# sourceMappingURL=errorHandler.js.map