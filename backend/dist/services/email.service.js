"use strict";
/**
 * EmailService — Abstraction for sending and receiving emails.
 *
 * This service is configured via environment variables.
 * When real SMTP/API credentials are provided, it will send actual emails.
 * Without credentials, it logs the email details for development.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
class EmailService {
    static isConfigured() {
        return !!(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASSWORD);
    }
    /**
     * Send an email. Returns true if sent (or logged in dev), false on error.
     */
    static async send(options) {
        const from = options.from || process.env.EMAIL_FROM || `PLENARY <noreply@${process.env.PLENARY_DOMAIN || "plenary.id"}>`;
        if (!this.isConfigured()) {
            console.log("[EmailService] Email not configured. Would send:");
            console.log(`  From: ${from}`);
            console.log(`  To: ${options.to}`);
            console.log(`  Subject: ${options.subject}`);
            console.log(`  Body: ${options.text || "(HTML)"}`);
            return true; // Return true in dev so flows continue
        }
        try {
            // Dynamic import safely to avoid compile-time missing module error
            let nodemailer = null;
            try {
                nodemailer = require("nodemailer");
            }
            catch {
                console.log("[EmailService] nodemailer module is not installed. Skipping actual send.");
                return true;
            }
            const transporter = nodemailer.createTransport({
                host: process.env.EMAIL_HOST,
                port: parseInt(process.env.EMAIL_PORT || "587", 10),
                secure: process.env.EMAIL_PORT === "465",
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASSWORD,
                },
            });
            await transporter.sendMail({
                from,
                to: options.to,
                subject: options.subject,
                text: options.text,
                html: options.html,
            });
            console.log(`[EmailService] Email sent to ${options.to}`);
            return true;
        }
        catch (error) {
            console.error("[EmailService] Failed to send email:", error);
            return false;
        }
    }
    // =========================================================
    // EMAIL TEMPLATES
    // =========================================================
    static async sendSellerApproval(data) {
        return this.send({
            to: data.to,
            subject: "PLENARY — Akun Seller Anda Telah Disetujui! 🎉",
            html: `
        <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <h1 style="color: #302a32; font-size: 24px;">Selamat, ${data.ownerName}! 🎉</h1>
          <p style="color: #81757e; font-size: 14px; line-height: 1.7;">
            Akun Seller Anda untuk <strong>${data.storeName}</strong> telah disetujui oleh Admin PLENARY.
          </p>
          <div style="background: #f9f5f7; border-radius: 12px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #302a32; margin: 0 0 12px;">Informasi Akun Anda:</h3>
            <p style="margin: 5px 0; color: #81757e;"><strong>Email Toko:</strong> ${data.storeEmail}</p>
            <p style="margin: 5px 0; color: #81757e;"><strong>Password Sementara:</strong> ${data.temporaryPassword}</p>
            <p style="margin: 5px 0; color: #81757e;"><strong>Account Code:</strong> ${data.accountCode}</p>
          </div>
          <p style="color: #e74c3c; font-size: 12px;">⚠️ Segera ganti password Anda setelah login pertama.</p>
          <p style="color: #81757e; font-size: 14px; line-height: 1.7;">
            Silakan login di <a href="${process.env.FRONTEND_URL || "http://localhost:3000"}/seller/login" style="color: #b57ca0;">PLENARY Seller Login</a>.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="color: #aaa; font-size: 11px;">PLENARY — Your Moments, Our Tickets.</p>
        </div>
      `,
        });
    }
    static async sendSellerRejection(data) {
        return this.send({
            to: data.to,
            subject: "PLENARY — Permohonan Seller Tidak Disetujui",
            html: `
        <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <h1 style="color: #302a32; font-size: 24px;">Halo, ${data.ownerName}</h1>
          <p style="color: #81757e; font-size: 14px; line-height: 1.7;">
            Mohon maaf, permohonan Seller untuk <strong>${data.storeName}</strong> belum dapat kami setujui saat ini.
          </p>
          ${data.reason ? `<div style="background: #fff5f5; border-radius: 12px; padding: 20px; margin: 20px 0;">
            <p style="color: #81757e;"><strong>Alasan:</strong> ${data.reason}</p>
          </div>` : ""}
          <p style="color: #81757e; font-size: 14px; line-height: 1.7;">
            Anda dapat mengajukan kembali atau menghubungi Admin di <a href="mailto:${process.env.ADMIN_EMAIL || "admin@plenary.id"}" style="color: #b57ca0;">${process.env.ADMIN_EMAIL || "admin@plenary.id"}</a>.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="color: #aaa; font-size: 11px;">PLENARY — Your Moments, Our Tickets.</p>
        </div>
      `,
        });
    }
    static async sendPasswordReset(data) {
        return this.send({
            to: data.to,
            subject: "PLENARY — Reset Password",
            html: `
        <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <h1 style="color: #302a32; font-size: 24px;">Reset Password</h1>
          <p style="color: #81757e; font-size: 14px; line-height: 1.7;">
            Halo ${data.name}, kami menerima permintaan reset password untuk akun Anda.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.resetUrl}" style="background: linear-gradient(105deg, #b57ca0, #da7899); color: white; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 600;">Reset Password</a>
          </div>
          <p style="color: #aaa; font-size: 12px;">Link ini berlaku selama 1 jam. Jika Anda tidak meminta reset password, abaikan email ini.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="color: #aaa; font-size: 11px;">PLENARY — Your Moments, Our Tickets.</p>
        </div>
      `,
        });
    }
}
exports.EmailService = EmailService;
//# sourceMappingURL=email.service.js.map