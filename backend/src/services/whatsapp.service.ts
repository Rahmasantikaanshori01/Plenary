/**
 * WhatsAppService — Abstraction for WhatsApp Business API integration.
 *
 * Configured via environment variables.
 * When credentials are not available, operations are logged for development.
 */

interface SendMessageInput {
  to: string; // Phone number with country code (e.g., "6282119729450")
  message: string;
}

interface WhatsAppMessageResult {
  success: boolean;
  messageId?: string;
  message?: string;
}

export class WhatsAppService {
  private static isConfigured(): boolean {
    return !!(process.env.WHATSAPP_API_URL && process.env.WHATSAPP_ACCESS_TOKEN);
  }

  /**
   * Generate a WhatsApp deep link with pre-filled message.
   */
  static generateDeepLink(phone: string, message: string): string {
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  }

  /**
   * Generate the seller registration message template.
   */
  static generateSellerRegistrationMessage(): string {
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
  static async sendMessage(input: SendMessageInput): Promise<WhatsAppMessageResult> {
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

      const data = await response.json() as { messages?: Array<{ id: string }> };

      if (data.messages?.[0]?.id) {
        return { success: true, messageId: data.messages[0].id };
      }

      return { success: false, message: "Gagal mengirim pesan WhatsApp." };
    } catch (error) {
      console.error("[WhatsAppService] Error:", error);
      return { success: false, message: "Gagal terhubung ke WhatsApp API." };
    }
  }

  /**
   * Handle incoming webhook from WhatsApp Business API.
   */
  static parseWebhook(body: Record<string, unknown>): {
    from?: string;
    message?: string;
    timestamp?: string;
  } | null {
    try {
      // Meta WhatsApp Cloud API webhook format
      const entry = (body.entry as Array<Record<string, unknown>>)?.[0];
      const changes = (entry?.changes as Array<Record<string, unknown>>)?.[0];
      const value = changes?.value as Record<string, unknown>;
      const messages = (value?.messages as Array<Record<string, unknown>>)?.[0];

      if (messages) {
        return {
          from: messages.from as string,
          message: (messages.text as Record<string, string>)?.body,
          timestamp: messages.timestamp as string,
        };
      }

      return null;
    } catch {
      return null;
    }
  }
}
