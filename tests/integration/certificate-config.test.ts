import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { defaultCertificateLayout } from "@/lib/certificate-layout";
import { getOrCreateCertificateConfig, saveCertificateLayout } from "@/server/certificate-config";

const runId = `itcc-${Date.now()}`;
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 2 }) });
const organizerId = `${runId}-org`;
let eventId = "";

beforeAll(async () => {
  await db.user.create({ data: { id: organizerId, name: organizerId, email: `${organizerId}@test.test`, emailVerified: true } });
  await db.organizerProfile.create({ data: { userId: organizerId, orgName: "IT", contactPhone: "081234567890" } });
  const event = await db.event.create({
    data: {
      organizerId,
      slug: runId,
      title: "Certificate config test",
      description: "Certificate config test",
      startAt: new Date(Date.now() + 86_400_000),
      endAt: new Date(Date.now() + 90_000_000),
      venue: "Test",
    },
  });
  eventId = event.id;
});

afterAll(async () => {
  await db.event.deleteMany({ where: { id: eventId } });
  await db.user.deleteMany({ where: { id: { startsWith: runId } } });
  await db.$disconnect();
});

describe("certificate config against Postgres", () => {
  it("creates one default config even when opened twice in parallel", async () => {
    const [first, second] = await Promise.all([
      getOrCreateCertificateConfig(eventId, db),
      getOrCreateCertificateConfig(eventId, db),
    ]);
    expect(first.id).toBe(second.id);
    expect(first.layout).toEqual(defaultCertificateLayout(0));
    expect(await db.certificateConfig.count({ where: { eventId } })).toBe(1);
  });

  it("saves the layout until the config is locked", async () => {
    const layout = defaultCertificateLayout(1);
    layout.recipientName.y = 0.5;
    expect(await saveCertificateLayout(eventId, layout, db)).toBe(true);
    expect((await getOrCreateCertificateConfig(eventId, db)).layout.recipientName.y).toBe(0.5);

    await db.certificateConfig.update({ where: { eventId }, data: { lockedAt: new Date() } });
    layout.recipientName.y = 0.6;
    expect(await saveCertificateLayout(eventId, layout, db)).toBe(false);
    expect((await getOrCreateCertificateConfig(eventId, db)).layout.recipientName.y).toBe(0.5);
  });
});
