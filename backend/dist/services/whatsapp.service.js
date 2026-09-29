"use strict";
/**
 * WhatsAppService — Abstraction for WhatsApp Business API integration.
 *
 * Configured via environment variables.
 * When credentials are not available, operations are logged for development.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppService = void 0;
class WhatsAppService {
    static isConfigured() {
        return !!(process.env.WHATSAPP_API_URL && process.env.WHATSAPP_ACCESS_TOKEN);
    }
    /**
     * Generate a WhatsApp deep link with pre-filled message.
     */
    static generateDeepLink(phone, message) {
        return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    }
    /**
     * Generate the seller registration message template.
     */
    static generateSellerRegistrationMessage() {
        return `Hallo Saya mau mendaftar sebagai Seller dan ini data diri dan akun saya

1. nama toko:
2. deskripsi toko:
3. alamat toko(ini alamat penaungnya, misal sekolah):
4. di naungi (contoh event sekolah, seller/panitia is account creator; or sanggar event with employee as seller):
5. NIK:
6. Nama pemilik:
7. Umur:
8. Tanggal lahir:
9. Jenis kelamin:`;
    }
    /**
     * Send a message via WhatsApp Business API.
     */
    static async sendMessage(input) {
        if (!this.isConfigured()) {
            console.log("[WhatsAppService] WhatsApp Business API not configured. Would send:");
            console.log(`  To: ${input.to}`);
            console.log(`  Message: ${input.message}`);
            return {
                success: true,
                message: "WhatsApp Business API belum dikonfigurasi. Set WHATSAPP_API_URL dan WHATSAPP_ACCESS_TOKEN di .env",
            };
        }
        try {
            const response = await fetch(`${process.env.WHATSAPP_API_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
                },
                body: JSON.stringify({
                    messaging_product: "whatsapp",
                    to: input.to,
                    type: "text",
                    text: { body: input.message },
                }),
            });
            const data = await response.json();
            if (data.messages?.[0]?.id) {
                return { success: true, messageId: data.messages[0].id };
            }
            return { success: false, message: "Gagal mengirim pesan WhatsApp." };
        }
        catch (error) {
            console.error("[WhatsAppService] Error:", error);
            return { success: false, message: "Gagal terhubung ke WhatsApp API." };
        }
    }
    /**
     * Handle incoming webhook from WhatsApp Business API.
     */
    static parseWebhook(body) {
        try {
            // Meta WhatsApp Cloud API webhook format
            const entry = body.entry?.[0];
            const changes = entry?.changes?.[0];
            const value = changes?.value;
            const messages = value?.messages?.[0];
            if (messages) {
                return {
                    from: messages.from,
                    message: messages.text?.body,
                    timestamp: messages.timestamp,
                };
            }
            return null;
        }
        catch {
            return null;
        }
    }
}
exports.WhatsAppService = WhatsAppService;
//# sourceMappingURL=whatsapp.service.js.map