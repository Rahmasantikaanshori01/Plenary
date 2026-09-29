/**
 * PaymentService — Abstraction for payment processing.
 *
 * Configured via environment variables.
 * Supports creating payments, checking status, and handling webhooks.
 * When credentials are not configured, returns proper error responses.
 */
export interface CreatePaymentInput {
    orderId: string;
    amount: number;
    buyerEmail: string;
    buyerName: string;
    description: string;
    items: Array<{
        name: string;
        price: number;
        quantity: number;
    }>;
}
export interface PaymentResult {
    success: boolean;
    transactionId?: string;
    externalId?: string;
    paymentUrl?: string;
    status?: string;
    message?: string;
}
export interface WebhookResult {
    valid: boolean;
    orderId?: string;
    status?: "PAID" | "FAILED" | "EXPIRED" | "CANCELLED";
    transactionId?: string;
}
export declare class PaymentService {
    private static isConfigured;
    /**
     * Create a payment session/transaction with the payment provider.
     */
    static createPayment(input: CreatePaymentInput): Promise<PaymentResult>;
    /**
     * Check the status of a payment.
     */
    static checkStatus(transactionId: string): Promise<PaymentResult>;
    /**
     * Validate and parse a webhook from the payment provider.
     */
    static handleWebhook(body: Record<string, unknown>, headers: Record<string, string>): Promise<WebhookResult>;
    private static createMidtransPayment;
    private static handleMidtransWebhook;
}
//# sourceMappingURL=payment.service.d.ts.map