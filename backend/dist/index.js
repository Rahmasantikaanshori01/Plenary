"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const passport_1 = __importDefault(require("passport"));
const auth_routes_1 = require("./routes/auth.routes");
const event_routes_1 = require("./routes/event.routes");
const wishlist_routes_1 = require("./routes/wishlist.routes");
const admin_routes_1 = require("./routes/admin.routes");
const seller_routes_1 = require("./routes/seller.routes");
const seller_application_routes_1 = require("./routes/seller-application.routes");
const buyer_routes_1 = require("./routes/buyer.routes");
const order_routes_1 = require("./routes/order.routes");
const payment_routes_1 = require("./routes/payment.routes");
const ticket_routes_1 = require("./routes/ticket.routes");
const notification_routes_1 = require("./routes/notification.routes");
const errorHandler_1 = require("./middleware/errorHandler");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Middleware
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
}));
app.use(express_1.default.json());
app.use(passport_1.default.initialize());
// Routes
app.use("/api/auth", auth_routes_1.authRouter);
app.use("/api/events", event_routes_1.eventRouter);
app.use("/api/wishlist", wishlist_routes_1.wishlistRouter);
app.use("/api/admin", admin_routes_1.adminRouter);
app.use("/api/sellers", seller_routes_1.sellerRouter);
app.use("/api/seller-applications", seller_application_routes_1.sellerApplicationRouter);
app.use("/api/buyers", buyer_routes_1.buyerRouter);
app.use("/api/orders", order_routes_1.orderRouter);
app.use("/api/payments", payment_routes_1.paymentRouter);
app.use("/api/tickets", ticket_routes_1.ticketRouter);
app.use("/api/notifications", notification_routes_1.notificationRouter);
// Health check
app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});
// Error handler
app.use(errorHandler_1.errorHandler);
app.listen(PORT, () => {
    console.log(`[Plenary] Backend running on http://localhost:${PORT}`);
});
exports.default = app;
//# sourceMappingURL=index.js.map