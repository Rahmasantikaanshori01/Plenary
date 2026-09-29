/**
 * Seed script to create the initial ADMIN account.
 *
 * Usage:
 *   npx ts-node prisma/seed.ts
 *   npm run create-admin
 *
 * The admin account is created with bcrypt-hashed password.
 * NEVER store plaintext passwords.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

async function main() {
  console.log("[Seed] Creating initial admin account...\n");

  const adminEmail = "admin@plenary.id";
  const adminUsername = "admin";
  const adminPassword = "PlenaryAdmin2024!";

  // Check if admin already exists
  const existing = await prisma.user.findFirst({
    where: { email: adminEmail, role: "ADMIN" },
  });

  if (existing) {
    console.log(`[Seed] Admin account already exists: ${adminEmail}`);
    console.log("[Seed] No changes made.");
    return;
  }

  const hashedPassword = await bcrypt.hash(adminPassword, SALT_ROUNDS);

  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      username: adminUsername,
      password: hashedPassword,
      role: "ADMIN",
    },
  });

  console.log("[Seed] ✅ Admin account created successfully!");
  console.log(`  ID:       ${admin.id}`);
  console.log(`  Email:    ${adminEmail}`);
  console.log(`  Username: ${adminUsername}`);
  console.log(`  Password: ${adminPassword}`);
  console.log("\n⚠️  IMPORTANT: Change this password after first login!");
  console.log("⚠️  Do NOT use these credentials in production.\n");
}

main()
  .catch((e) => {
    console.error("[Seed] Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
