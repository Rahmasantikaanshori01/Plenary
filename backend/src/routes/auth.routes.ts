import { Router, Request, Response, NextFunction } from "express";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { PrismaClient } from "@prisma/client";
import { hashPassword, comparePassword } from "../utils/hash";
import { signToken } from "../utils/jwt";
import { ActivityLogService } from "../services/activity.service";

const router = Router();
const prisma = new PrismaClient();

// =========================================================
// GOOGLE OAUTH STRATEGY
// =========================================================

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:5000/api/auth/google/callback",
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const googleId = profile.id;
          const email = profile.emails?.[0]?.value;
          const displayName = profile.displayName;

          // Check if user exists by googleId
          let user = await prisma.user.findUnique({ where: { googleId } });

          if (!user && email) {
            // Check if user exists by email
            user = await prisma.user.findUnique({ where: { email } });
            if (user) {
              // Link Google to existing account
              user = await prisma.user.update({
                where: { id: user.id },
                data: { googleId },
              });
            }
          }

          if (!user) {
            // Create new buyer account
            user = await prisma.user.create({
              data: {
                googleId,
                email: email || undefined,
                username: displayName || `user_${googleId.slice(0, 8)}`,
                role: "BUYER",
              },
            });
          }

          done(null, user);
        } catch (err) {
          done(err as Error);
        }
      }
    )
  );
} else {
  console.warn("[Auth] Google OAuth credentials not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env");
}

// =========================================================
// BUYER REGISTER
// =========================================================

router.post("/buyer/register", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { nik, username, email, age, birthDate, gender, password } = req.body;

    // Validation
    if (!nik || !username || !email || !age || !birthDate || !gender || !password) {
      res.status(400).json({ message: "Semua field wajib diisi." });
      return;
    }

    if (nik.length !== 16 || !/^\d+$/.test(nik)) {
      res.status(400).json({ message: "NIK harus 16 digit angka." });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ message: "Password minimal 6 karakter." });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ message: "Format email tidak valid." });
      return;
    }

    // Validate gender
    if (!["MALE", "FEMALE"].includes(gender)) {
      res.status(400).json({ message: "Jenis kelamin tidak valid." });
      return;
    }

    // Validate birthDate and age consistency
    const birth = new Date(birthDate);
    if (isNaN(birth.getTime())) {
      res.status(400).json({ message: "Tanggal lahir tidak valid." });
      return;
    }

    // Check NIK uniqueness in BuyerProfile
    const existingNik = await prisma.buyerProfile.findUnique({ where: { nik } });
    if (existingNik) {
      res.status(409).json({ message: "NIK sudah terdaftar. Satu NIK hanya boleh memiliki satu akun." });
      return;
    }

    // Check username uniqueness
    const existingUsername = await prisma.user.findUnique({ where: { username } });
    if (existingUsername) {
      res.status(409).json({ message: "Username sudah digunakan." });
      return;
    }

    // Check email uniqueness
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      res.status(409).json({ message: "Email sudah terdaftar." });
      return;
    }

    const hashed = await hashPassword(password);

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          username,
          password: hashed,
          role: "BUYER",
        },
      });

      await tx.buyerProfile.create({
        data: {
          userId: newUser.id,
          nik,
          age: parseInt(age, 10),
          birthDate: birth,
          gender,
        },
      });

      return newUser;
    });

    // Log activity
    await ActivityLogService.log({
      userId: user.id,
      role: "BUYER",
      action: "REGISTER",
      entity: "user",
      entityId: user.id,
      details: `Buyer registered: ${username}`,
      ipAddress: req.ip,
    });

    const token = signToken({ userId: user.id, role: user.role, email: user.email || undefined });

    res.status(201).json({
      message: "Registrasi berhasil!",
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role },
    });
  } catch (err) {
    next(err);
  }
});

// =========================================================
// BUYER LOGIN
// =========================================================

router.post("/buyer/login", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      res.status(400).json({ message: "Email/Username dan Password wajib diisi." });
      return;
    }

    // Find by username or email
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: identifier },
          { email: identifier },
        ],
        role: "BUYER",
      },
    });

    if (!user || !user.password) {
      res.status(401).json({ message: "Email/Username atau Password salah." });
      return;
    }

    const valid = await comparePassword(password, user.password);
    if (!valid) {
      res.status(401).json({ message: "Email/Username atau Password salah." });
      return;
    }

    const token = signToken({ userId: user.id, role: user.role, email: user.email || undefined });

    // Log activity
    await ActivityLogService.log({
      userId: user.id,
      role: "BUYER",
      action: "LOGIN",
      entity: "user",
      entityId: user.id,
      ipAddress: req.ip,
    });

    res.json({
      message: "Login berhasil!",
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        loyaltyPoints: user.loyaltyPoints,
      },
    });
  } catch (err) {
    next(err);
  }
});

// =========================================================
// SELLER LOGIN (3-Stage verification)
// =========================================================

router.post("/seller/login", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      // Stage 1: Personal data
      nik, ownerName, age, birthDate, gender,
      // Stage 2: Store data
      storeName, storeAddress, email, password,
      // Stage 3: Account code
      accountCode,
    } = req.body;

    // Validate required fields
    if (!nik || !ownerName || !email || !password || !accountCode) {
      res.status(400).json({ message: "Semua field wajib diisi pada setiap tahap login." });
      return;
    }

    // Find seller by store email
    const sellerProfile = await prisma.sellerProfile.findUnique({
      where: { storeEmail: email },
      include: { user: true },
    });

    if (!sellerProfile) {
      res.status(401).json({ message: "Akun seller tidak ditemukan." });
      return;
    }

    // Verify account code
    if (sellerProfile.accountCode !== accountCode) {
      res.status(401).json({ message: "Account Code tidak valid." });
      return;
    }

    // Verify seller is approved
    const verification = await prisma.sellerVerification.findUnique({
      where: { userId: sellerProfile.userId },
    });

    if (!verification || verification.status !== "APPROVED") {
      res.status(403).json({ message: "Akun seller belum disetujui oleh Admin. Hubungi Admin untuk info lebih lanjut." });
      return;
    }

    // Verify personal data matches verification record
    if (verification.nik !== nik) {
      res.status(401).json({ message: "NIK tidak cocok dengan data yang terdaftar." });
      return;
    }

    if (verification.ownerName.toLowerCase() !== ownerName.toLowerCase()) {
      res.status(401).json({ message: "Nama pemilik tidak cocok dengan data yang terdaftar." });
      return;
    }

    // Verify password
    const user = sellerProfile.user;
    if (!user.password) {
      res.status(401).json({ message: "Password belum diatur. Hubungi Admin." });
      return;
    }

    const valid = await comparePassword(password, user.password);
    if (!valid) {
      res.status(401).json({ message: "Password salah." });
      return;
    }

    const token = signToken({ userId: user.id, role: user.role, email: user.email || undefined });

    // Log activity
    await ActivityLogService.log({
      userId: user.id,
      role: "SELLER",
      action: "LOGIN",
      entity: "user",
      entityId: user.id,
      ipAddress: req.ip,
    });

    res.json({
      message: "Login berhasil!",
      token,
      mustChangePassword: user.mustChangePassword,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        storeName: sellerProfile.storeName,
      },
    });
  } catch (err) {
    next(err);
  }
});

// =========================================================
// ADMIN LOGIN
// =========================================================

router.post("/admin/login", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: "Email dan Password wajib diisi." });
      return;
    }

    const user = await prisma.user.findFirst({
      where: { email, role: "ADMIN" },
    });

    if (!user || !user.password) {
      res.status(401).json({ message: "Email atau Password salah." });
      return;
    }

    const valid = await comparePassword(password, user.password);
    if (!valid) {
      res.status(401).json({ message: "Email atau Password salah." });
      return;
    }

    const token = signToken({ userId: user.id, role: user.role, email: user.email || undefined });

    // Log activity
    await ActivityLogService.log({
      userId: user.id,
      role: "ADMIN",
      action: "LOGIN",
      entity: "user",
      entityId: user.id,
      ipAddress: req.ip,
    });

    res.json({
      message: "Login berhasil!",
      token,
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch (err) {
    next(err);
  }
});

// =========================================================
// CHANGE PASSWORD (any authenticated user)
// =========================================================

router.post("/change-password", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ message: "Token tidak ditemukan." });
      return;
    }

    const { verifyToken } = await import("../utils/jwt");
    const payload = verifyToken(authHeader.split(" ")[1]);

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ message: "Password lama dan baru wajib diisi." });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ message: "Password baru minimal 6 karakter." });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.password) {
      res.status(401).json({ message: "User tidak ditemukan." });
      return;
    }

    const valid = await comparePassword(currentPassword, user.password);
    if (!valid) {
      res.status(401).json({ message: "Password lama salah." });
      return;
    }

    const hashed = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, mustChangePassword: false },
    });

    await ActivityLogService.log({
      userId: user.id,
      role: user.role,
      action: "CHANGE_PASSWORD",
      entity: "user",
      entityId: user.id,
      ipAddress: req.ip,
    });

    res.json({ message: "Password berhasil diubah." });
  } catch (err) {
    next(err);
  }
});

// =========================================================
// GOOGLE OAUTH ROUTES
// =========================================================

router.get("/google", (req: Request, res: Response, next: NextFunction) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    res.status(503).json({ message: "Google OAuth belum dikonfigurasi. Set GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET di .env" });
    return;
  }
  passport.authenticate("google", { scope: ["profile", "email"], session: false })(req, res, next);
});

router.get(
  "/google/callback",
  (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate("google", { session: false, failureRedirect: `${process.env.FRONTEND_URL || "http://localhost:3000"}/buyer/login?error=google_failed` }, (err: Error | null, user: { id: string; role: string; email: string | null }) => {
      if (err || !user) {
        return res.redirect(`${process.env.FRONTEND_URL || "http://localhost:3000"}/buyer/login?error=google_failed`);
      }

      const token = signToken({ userId: user.id, role: user.role, email: user.email || undefined });
      // Redirect to frontend with token
      res.redirect(`${process.env.FRONTEND_URL || "http://localhost:3000"}/buyer/login?token=${token}&user=${encodeURIComponent(JSON.stringify({ id: user.id, role: user.role, email: user.email }))}`);
    })(req, res, next);
  }
);

// =========================================================
// TIKTOK OAUTH ROUTES (Structure ready)
// =========================================================

router.get("/tiktok", (_req: Request, res: Response) => {
  if (!process.env.TIKTOK_CLIENT_KEY) {
    res.status(503).json({ message: "TikTok OAuth belum dikonfigurasi. Set TIKTOK_CLIENT_KEY dan TIKTOK_CLIENT_SECRET di .env" });
    return;
  }
  // TikTok OAuth URL
  const authUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${process.env.TIKTOK_CLIENT_KEY}&scope=user.info.basic&response_type=code&redirect_uri=${encodeURIComponent(process.env.TIKTOK_CALLBACK_URL || "http://localhost:5000/api/auth/tiktok/callback")}`;
  res.redirect(authUrl);
});

router.get("/tiktok/callback", async (req: Request, res: Response) => {
  const { code } = req.query;
  if (!code) {
    res.redirect(`${process.env.FRONTEND_URL || "http://localhost:3000"}/buyer/login?error=tiktok_failed`);
    return;
  }
  // TODO: Exchange code for access token when TikTok credentials are configured
  res.redirect(`${process.env.FRONTEND_URL || "http://localhost:3000"}/buyer/login?error=tiktok_not_configured`);
});

// =========================================================
// FACEBOOK OAUTH ROUTES (Structure ready)
// =========================================================

router.get("/facebook", (_req: Request, res: Response) => {
  if (!process.env.FACEBOOK_APP_ID) {
    res.status(503).json({ message: "Facebook OAuth belum dikonfigurasi. Set FACEBOOK_APP_ID dan FACEBOOK_APP_SECRET di .env" });
    return;
  }
  const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${process.env.FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(process.env.FACEBOOK_CALLBACK_URL || "http://localhost:5000/api/auth/facebook/callback")}&scope=email,public_profile`;
  res.redirect(authUrl);
});

router.get("/facebook/callback", async (req: Request, res: Response) => {
  const { code } = req.query;
  if (!code) {
    res.redirect(`${process.env.FRONTEND_URL || "http://localhost:3000"}/buyer/login?error=facebook_failed`);
    return;
  }
  // TODO: Exchange code for access token when Facebook credentials are configured
  res.redirect(`${process.env.FRONTEND_URL || "http://localhost:3000"}/buyer/login?error=facebook_not_configured`);
});

export { router as authRouter };
