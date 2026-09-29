import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import path from "path";
import passport from "passport";
import { authRouter } from "./routes/auth.routes";
import { eventRouter } from "./routes/event.routes";
import { wishlistRouter } from "./routes/wishlist.routes";
import { adminRouter } from "./routes/admin.routes";
import { sellerRouter } from "./routes/seller.routes";
import { sellerApplicationRouter } from "./routes/seller-application.routes";
import { buyerRouter } from "./routes/buyer.routes";
import { orderRouter } from "./routes/order.routes";
import { paymentRouter } from "./routes/payment.routes";
import { ticketRouter } from "./routes/ticket.routes";
import { notificationRouter } from "./routes/notification.routes";
import { errorHandler } from "./middleware/errorHandler";

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(passport.initialize());

// Static file serving for uploads
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Routes
app.use("/api/auth", authRouter);
app.use("/api/events", eventRouter);
app.use("/api/wishlist", wishlistRouter);
app.use("/api/admin", adminRouter);
app.use("/api/sellers", sellerRouter);
app.use("/api/seller-applications", sellerApplicationRouter);
app.use("/api/buyers", buyerRouter);
app.use("/api/orders", orderRouter);
app.use("/api/payments", paymentRouter);
app.use("/api/tickets", ticketRouter);
app.use("/api/notifications", notificationRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[Plenary] Backend running on http://localhost:${PORT}`);
});

export default app;
