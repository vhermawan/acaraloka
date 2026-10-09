import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { assertAdminSeedable } from "./admin-seed";

config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL belum diisi. Lihat .env.example.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const SAMPLE_ORGANIZER_EMAIL = "organizer@example.test";

async function seedAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim();
  if (!adminEmail) {
    console.warn(
      "ADMIN_EMAIL kosong di .env.local, melewatkan pembuatan akun admin dan event contoh.",
    );
    return null;
  }

  const existing = await prisma.user.findUnique({ where: { email: adminEmail }, select: { role: true } });
  assertAdminSeedable(adminEmail, existing?.role ?? null);

  return prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      id: randomUUID(),
      email: adminEmail,
      name: "Admin Acaraloka",
      emailVerified: true,
      role: "ADMIN",
    },
  });
}

async function seedSampleEvent() {
  const organizer = await prisma.user.upsert({
    where: { email: SAMPLE_ORGANIZER_EMAIL },
    update: {},
    create: {
      id: randomUUID(),
      email: SAMPLE_ORGANIZER_EMAIL,
      name: "Panitia Contoh",
      emailVerified: true,
      role: "ORGANIZER",
    },
  });

  await prisma.organizerProfile.upsert({
    where: { userId: organizer.id },
    update: {},
    create: {
      userId: organizer.id,
      orgName: "Acaraloka",
      contactPhone: "081200000000",
    },
  });

  const startAt = new Date();
  startAt.setDate(startAt.getDate() + 7);
  const endAt = new Date(startAt);
  endAt.setHours(endAt.getHours() + 2);

  const event = await prisma.event.upsert({
    where: { slug: "contoh-workshop-acaraloka" },
    update: {},
    create: {
      organizerId: organizer.id,
      slug: "contoh-workshop-acaraloka",
      title: "Contoh Workshop Acaraloka",
      description: "Event contoh untuk memverifikasi alur pendaftaran gratis Tahap 1.",
      startAt,
      endAt,
      venue: "Online",
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  });

  await prisma.ticketType.upsert({
    where: { id: `${event.id}-general` },
    update: {},
    create: {
      id: `${event.id}-general`,
      eventId: event.id,
      name: "Umum",
      price: 0,
      quota: 100,
    },
  });
}

async function main() {
  const admin = await seedAdmin();
  if (admin) {
    await seedSampleEvent();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
