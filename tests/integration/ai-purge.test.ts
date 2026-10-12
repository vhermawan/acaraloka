import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";

const store = vi.hoisted(() => new Map<string, string>());

vi.mock("@/server/storage", () => {
  const key = (bucket: string, path: string) => `${bucket}/${path}`;
  return {
    AI_BUCKET: "ai-generations",
    listObjects: async (bucket: string, prefix: string) =>
      [...store.keys()].filter((entry) => entry.startsWith(`${bucket}/${prefix.replace(/\/+$/, "")}/`)).map((entry) => entry.slice(bucket.length + 1)),
    removeObjects: async (bucket: string, paths: string[]) => {
      for (const path of paths) store.delete(key(bucket, path));
    },
  };
});

vi.mock("@/server/error-log", () => ({ recordError: async () => undefined }));

const { purgeAiArtifacts } = await import("@/server/ai/purge");

const runId = `itpg${Date.now()}`;
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 4 }) });
const userId = `${runId}-org`;
const eventIds: string[] = [];
const DAY = 86_400_000;
let counter = 0;

async function createEvent(endedDaysAgo: number) {
  counter += 1;
  const event = await db.event.create({
    data: {
      organizerId: userId,
      slug: `${runId}-e${counter}`,
      title: `Acara ${runId} ${counter}`,
      description: "x",
      startAt: new Date(Date.now() - (endedDaysAgo + 1) * DAY),
      endAt: new Date(Date.now() - endedDaysAgo * DAY),
      venueName: "Test",
    },
  });
  eventIds.push(event.id);
  store.set(`ai-generations/events/${event.id}/logo-0123456789abcdef.png`, "logo");
  return event.id;
}

async function seed(eventId: string, data: { status?: "SUCCEEDED" | "FAILED"; firstUsedAt?: Date; createdAt?: Date } = {}) {
  const generation = await db.aiGeneration.create({
    data: {
      eventId,
      userId,
      kind: "CERTIFICATE",
      status: data.status ?? "SUCCEEDED",
      input: {},
      promptVersion: "test",
      firstUsedAt: data.firstUsedAt,
      createdAt: data.createdAt,
    },
  });
  store.set(`ai-generations/events/${eventId}/cert-${generation.id}.jpg`, "a");
  store.set(`ai-generations/events/${eventId}/cert-${generation.id}-thumb.jpg`, "t");
  return generation.id;
}

const filesOf = (eventId: string) => [...store.keys()].filter((entry) => entry.startsWith(`ai-generations/events/${eventId}/`));
const scoped = () => ({ eventIds: [...eventIds] });

beforeAll(async () => {
  await db.user.create({ data: { id: userId, name: userId, email: `${userId}@test.test`, emailVerified: true } });
  await db.organizerProfile.create({ data: { userId, orgName: "IT", contactPhone: "081234567890" } });
});

afterAll(async () => {
  await db.aiGeneration.deleteMany({ where: { userId } });
  await db.event.deleteMany({ where: { id: { in: eventIds } } });
  await db.user.deleteMany({ where: { id: { startsWith: runId } } });
  await db.$disconnect();
});

describe("purgeAiArtifacts against Postgres", () => {
  it("purges unused results and logos of long-ended events and keeps the row", async () => {
    const eventId = await createEvent(40);
    const genId = await seed(eventId);

    const result = await purgeAiArtifacts(db, scoped());

    expect(result).toMatchObject({ unusedResults: 1, logoObjects: 1 });
    expect(filesOf(eventId)).toEqual([]);
    expect((await db.aiGeneration.findUniqueOrThrow({ where: { id: genId } })).purgedAt).not.toBeNull();
  });

  it("is idempotent", async () => {
    const eventId = await createEvent(45);
    await seed(eventId);

    await purgeAiArtifacts(db, scoped());
    expect(await purgeAiArtifacts(db, scoped())).toMatchObject({ unusedResults: 0, failedRows: 0, logoObjects: 0, objectsRemoved: 0 });
  });

  it("leaves recent events, used results and their logos alone", async () => {
    const recent = await createEvent(5);
    const recentGen = await seed(recent);
    const used = await createEvent(50);
    const usedGen = await seed(used, { firstUsedAt: new Date() });

    await purgeAiArtifacts(db, scoped());

    expect(filesOf(recent)).toHaveLength(3);
    expect(filesOf(used)).toHaveLength(3);
    const rows = await db.aiGeneration.findMany({ where: { id: { in: [recentGen, usedGen] } } });
    expect(rows.every((row) => row.purgedAt === null)).toBe(true);
  });

  it("purges leftovers of failed rows after the grace period only", async () => {
    const eventId = await createEvent(2);
    const old = await seed(eventId, { status: "FAILED", createdAt: new Date(Date.now() - 2 * DAY) });
    const fresh = await seed(eventId, { status: "FAILED" });

    const result = await purgeAiArtifacts(db, scoped());

    expect(result.failedRows).toBe(1);
    expect(filesOf(eventId).filter((path) => path.includes(old))).toEqual([]);
    expect(filesOf(eventId).filter((path) => path.includes(fresh))).toHaveLength(2);
  });

  it("does not purge a result that was applied to a certificate config", async () => {
    const eventId = await createEvent(60);
    const genId = await seed(eventId);
    await db.certificateConfig.create({
      data: { eventId, builtinKey: "classic", pageWidth: 841.89, pageHeight: 595.28, layout: {}, aiGenerationId: genId },
    });

    await purgeAiArtifacts(db, scoped());

    expect(filesOf(eventId)).toHaveLength(3);
    expect((await db.aiGeneration.findUniqueOrThrow({ where: { id: genId } })).purgedAt).toBeNull();
    await db.certificateConfig.delete({ where: { eventId } });
  });
});
