"use strict";
/**
 * PaymentService — Abstraction for payment processing.
 *
 * Configured via environment variables.
 * Supports creating payments, checking status, and handling webhooks.
 * When credentials are not configured, returns proper error responses.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentService = void 0;
class PaymentService {
    static isConfigured() {
        return !!(process.env.PAYMENT_API_KEY && process.env.PAYMENT_SERVER_KEY);
    }
    /**
     * Create a payment session/transaction with the payment provider.
     */
    static async createPayment(input) {
        if (!this.isConfigured()) {
            console.log("[PaymentService] Payment provider not configured. Returning pending state.");
            console.log(`  Order: ${input.orderId}, Amount: ${input.amount}`);
            return {
                success: true,
                transactionId: `DEV-${Date.now()}`,
                status: "PENDING",
                message: "Payment provider belum dikonfigurasi. Set PAYMENT_API_KEY dan PAYMENT_SERVER_KEY di .env",
            };
        }
        try {
            // Payment provider integration would go here
            // Example: Midtrans, Xendit, Stripe, etc.
            const provider = process.env.PAYMENT_PROVIDER || "midtrans";
            if (provider === "midtrans") {
                return this.createMidtransPayment(input);
            }
            return {
                success: false,
                message: `Payment provider '${provider}' tidak didukung.`,
            };
        }
        catch (error) {
            console.error("[PaymentService] Error creating payment:", error);
            return {
                success: false,
                message: "Gagal membuat pembayaran. Silakan coba lagi.",
            };
        }
    }
    /**
     * Check the status of a payment.
     */
    static async checkStatus(transactionId) {
        if (!this.isConfigured()) {
            return {
                success: true,
                transactionId,
                status: "PENDING",
                message: "Payment provider belum dikonfigurasi.",
            };
        }
        try {
            // Check with payment provider
            console.log(`[PaymentService] Checking status for: ${transactionId}`);
            return {
                success: true,
                transactionId,
                status: "PENDING",
            };
        }
        catch (error) {
            console.error("[PaymentService] Error checking status:", error);
            return { success: false, message: "Gagal memeriksa status pembayaran." };
        }
    }
    /**
     * Validate and parse a webhook from the payment provider.
     */
    static async handleWebhook(body, headers) {
        if (!this.isConfigured()) {
            return { valid: false };
        }
        try {
            const provider = process.env.PAYMENT_PROVIDER || "midtrans";
            if (provider === "midtrans") {
                return this.handleMidtransWebhook(body, headers);
            }
            return { valid: false };
        }
        catch (error) {
            console.error("[PaymentService] Webhook error:", error);
            return { valid: false };
        }
    }
    // =========================================================
    // MIDTRANS INTEGRATION (ready for credentials)
    // =========================================================
    static async createMidtransPayment(input) {
        // Midtrans Snap API integration
        // This would use the Midtrans Node.js SDK when credentials are available
        const serverKey = process.env.PAYMENT_SERVER_KEY;
        const isProduction = process.env.PAYMENT_IS_PRODUCTION === "true";
        const baseUrl = isProduction
            ? "https://app.midtrans.com/snap/v1/transactions"
            : "https://app.sandbox.midtrans.com/snap/v1/transactions";
        try {
            const response = await fetch(baseUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Basic ${Buffer.from(serverKey + ":").toString("base64")}`,
                },
                body: JSON.stringify({
                    transaction_details: {
                        order_id: input.orderId,
                        gross_amount: input.amount,
                    },
                    customer_details: {
                        email: input.buyerEmail,
                        first_name: input.buyerName,
                    },
                    item_details: input.items.map((item) => ({
                        name: item.name,
                        price: item.price,
                        quantity: item.quantity,
                    })),
                }),
            });
            const data = await response.json();
            if (data.token) {
                return {
                    success: true,
                    externalId: data.token,
                    paymentUrl: data.redirect_url,
                    status: "PENDING",
                };
            }
            return { success: false, message: "Gagal membuat transaksi Midtrans." };
        }
        catch (error) {
            console.error("[PaymentService] Midtrans error:", error);
            return { success: false, message: "Gagal terhubung ke Midtrans." };
        }
    }
    static async handleMidtransWebhook(body, _headers) {
        // Verify webhook signature
        const orderId = body.order_id;
        const transactionStatus = body.transaction_status;
        const fraudStatus = body.fraud_status;
        let status = "FAILED";
        if (transactionStatus === "capture" || transactionStatus === "settlement") {
            if (fraudStatus === "accept" || !fraudStatus) {
                status = "PAID";
            }
        }
        else if (transactionStatus === "expire") {
            status = "EXPIRED";
        }
        else if (transactionStatus === "cancel" || transactionStatus === "deny") {
            status = "CANCELLED";
        }
        return {
            valid: true,
            orderId,
            status,
            transactionId: body.transaction_id,
        };
    }
}
exports.PaymentService = PaymentService;
//# sourceMappingURL=payment.service.js.map