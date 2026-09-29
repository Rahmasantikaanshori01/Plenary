/**
 * EmailService — Abstraction for sending and receiving emails.
 *
 * This service is configured via environment variables.
 * When real SMTP/API credentials are provided, it will send actual emails.
 * Without credentials, it logs the email details for development.
 */
interface EmailOptions {
    to: string;
    subject: string;
    text?: string;
    html?: string;
    from?: string;
}
export declare class EmailService {
    private static isConfigured;
    /**
     * Send an email. Returns true if sent (or logged in dev), false on error.
     */
    static send(options: EmailOptions): Promise<boolean>;
    static sendSellerApproval(data: {
        to: string;
        ownerName: string;
        storeName: string;
        storeEmail: string;
        temporaryPassword: string;
        accountCode: string;
    }): Promise<boolean>;
    static sendSellerRejection(data: {
        to: string;
        ownerName: string;
        storeName: string;
        reason?: string;
    }): Promise<boolean>;
    static sendPasswordReset(data: {
        to: string;
        name: string;
        resetUrl: string;
    }): Promise<boolean>;
}
export {};
//# sourceMappingURL=email.service.d.ts.map