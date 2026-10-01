import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL belum diisi. Lihat .env.example.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function seedAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim();
  if (!adminEmail) {
    console.warn(
      "ADMIN_EMAIL kosong di .env.local, melewatkan pembuatan akun admin dan event contoh.",
    );
    return null;
  }

  return prisma.user.upsert({
    where: { email: adminEmail },
    update: { isAdmin: true },
    create: {
      id: randomUUID(),
      email: adminEmail,
      name: "Admin event-in",
      emailVerified: true,
      isAdmin: true,
    },
  });
}

async function seedSampleEvent(adminUserId: string) {
  await prisma.organizerProfile.upsert({
    where: { userId: adminUserId },
    update: {},
    create: {
      userId: adminUserId,
      orgName: "event-in",
      contactPhone: "081200000000",
    },
  });

  const startAt = new Date();
  startAt.setDate(startAt.getDate() + 7);
  const endAt = new Date(startAt);
  endAt.setHours(endAt.getHours() + 2);

  const event = await prisma.event.upsert({
    where: { slug: "contoh-workshop-event-in" },
    update: {},
    create: {
      organizerId: adminUserId,
      slug: "contoh-workshop-event-in",
      title: "Contoh Workshop event-in",
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
    await seedSampleEvent(admin.id);
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
