import { existsSync } from "node:fs";

import { config } from "dotenv";

if (existsSync(".env.local")) config({ path: ".env.local" });

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Pemakaian: pnpm ai:allow <email-akun-panitia>");
  process.exit(1);
}

const { prisma } = await import("../src/server/db");
const { addAiAllowlist } = await import("../src/server/ai-allowlist");

try {
  const [admin, target] = await Promise.all([
    prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } }),
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
  ]);
  const actorId = admin?.id ?? target?.id;
  if (!actorId) {
    console.error("Akun dengan email ini tidak ditemukan.");
    process.exitCode = 1;
  } else {
    const result = await addAiAllowlist({ email, actorId });
    if (result.ok) console.log(`${email} sekarang ada di daftar akses AI.`);
    else if (result.reason === "ALREADY_ALLOWED") console.log(`${email} sudah ada di daftar akses AI.`);
    else {
      console.error("Akun dengan email ini belum terdaftar sebagai panitia (role ORGANIZER dengan profil).");
      process.exitCode = 1;
    }
  }
} finally {
  await prisma.$disconnect();
}
