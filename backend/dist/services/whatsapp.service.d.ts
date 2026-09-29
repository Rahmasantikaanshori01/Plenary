/**
 * WhatsAppService — Abstraction for WhatsApp Business API integration.
 *
 * Configured via environment variables.
 * When credentials are not available, operations are logged for development.
 */
interface SendMessageInput {
    to: string;
    message: string;
}
interface WhatsAppMessageResult {
    success: boolean;
    messageId?: string;
    message?: string;
}
export declare class WhatsAppService {
    private static isConfigured;
    /**
     * Generate a WhatsApp deep link with pre-filled message.
     */
    static generateDeepLink(phone: string, message: string): string;
    /**
     * Generate the seller registration message template.
     */
    static generateSellerRegistrationMessage(): string;
    /**
     * Send a message via WhatsApp Business API.
     */
    static sendMessage(input: SendMessageInput): Promise<WhatsAppMessageResult>;
    /**
     * Handle incoming webhook from WhatsApp Business API.
     */
    static parseWebhook(body: Record<string, unknown>): {
        from?: string;
        message?: string;
        timestamp?: string;
    } | null;
}
export {};
//# sourceMappingURL=whatsapp.service.d.ts.map