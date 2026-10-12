import { PrismaPg } from "@prisma/adapter-pg";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { aiDesignBriefSchema, toCertificateLayout } from "@/lib/ai/design-brief";
import { presetBriefFor } from "@/lib/ai/style-presets";
import { countEventKind } from "@/server/ai-quota";
import { isBackgroundPathFor } from "@/lib/certificate-background";
import { parseCertificateLayout } from "@/lib/certificate-layout";

const store = vi.hoisted(() => new Map<string, Uint8Array>());

vi.mock("@/server/storage", () => {
  const key = (bucket: string, path: string) => `${bucket}/${path}`;
  const entriesIn = (bucket: string, prefix: string) =>
    [...store.keys()].filter((entry) => entry.startsWith(`${bucket}/${prefix.replace(/\/+$/, "")}/`)).map((entry) => entry.slice(bucket.length + 1));
  return {
    AI_BUCKET: "ai-generations",
    CERTIFICATE_BACKGROUND_BUCKET: "certificate-backgrounds",
    downloadObject: async (bucket: string, path: string) => {
      const found = store.get(key(bucket, path));
      if (!found) throw new Error("missing");
      return found;
    },
    uploadObject: async (bucket: string, path: string, body: Uint8Array) => {
      store.set(key(bucket, path), body);
    },
    listObjects: async (bucket: string, prefix: string) => entriesIn(bucket, prefix),
    removeObjects: async (bucket: string, paths: string[]) => {
      for (const path of paths) store.delete(key(bucket, path));
    },
  };
});

const { applyAiDesign } = await import("@/server/ai/apply-design");
const { getOrCreateCertificateConfig } = await import("@/server/certificate-config");
const { reportAiGeneration } = await import("@/server/ai-report");

const runId = `itap${Date.now()}`;
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 6 }) });
const userId = `${runId}-org`;
const eventIds: string[] = [];
let counter = 0;
let original: Uint8Array;
let logo: Uint8Array;

const brief = aiDesignBriefSchema.parse({
  ...presetBriefFor("minimal", null),
  palette: { primary: "#0f766e", secondary: "#6d28d9", background: "#ffffff", text: "#123456" },
});

function cert(bucket: string, eventId: string) {
  return [...store.keys()].filter((entry) => entry.startsWith(`${bucket}/events/${eventId}/`));
}

async function createEvent() {
  counter += 1;
  const event = await db.event.create({
    data: {
      organizerId: userId,
      slug: `${runId}-e${counter}`,
      title: `Acara ${runId} ${counter}`,
      description: "x",
      startAt: new Date(Date.now() + 86_400_000),
      endAt: new Date(Date.now() + 90_000_000),
      venueName: "Test",
    },
  });
  eventIds.push(event.id);
  store.set(`ai-generations/events/${event.id}/logo-0123456789abcdef.png`, logo);
  return event.id;
}

async function seedGeneration(eventId: string) {
  const generation = await db.aiGeneration.create({
    data: {
      eventId,
      userId,
      kind: "CERTIFICATE",
      status: "SUCCEEDED",
      input: { style: "minimal", colorHex: null, note: "" },
      brief,
      promptVersion: "test",
      resultPaths: [],
      finishedAt: new Date(),
    },
  });
  const paths = [`events/${eventId}/cert-${generation.id}.jpg`, `events/${eventId}/cert-${generation.id}-thumb.jpg`];
  await db.aiGeneration.update({ where: { id: generation.id }, data: { resultPaths: paths } });
  store.set(`ai-generations/${paths[0]}`, original);
  store.set(`ai-generations/${paths[1]}`, original);
  return generation.id;
}

const logoPathOf = (eventId: string) => `events/${eventId}/logo-0123456789abcdef.png`;

beforeAll(async () => {
  original = new Uint8Array(await sharp({ create: { width: 2480, height: 1754, channels: 3, background: "#e8eef7" } }).jpeg().toBuffer());
  logo = new Uint8Array(await sharp({ create: { width: 300, height: 300, channels: 4, background: "#cc0000" } }).png().toBuffer());
  await db.user.create({ data: { id: userId, name: userId, email: `${userId}@test.test`, emailVerified: true } });
  await db.organizerProfile.create({ data: { userId, orgName: "IT", contactPhone: "081234567890" } });
});

afterAll(async () => {
  await db.certificateConfig.deleteMany({ where: { eventId: { in: eventIds } } });
  await db.aiGeneration.deleteMany({ where: { userId } });
  await db.event.deleteMany({ where: { id: { in: eventIds } } });
  await db.user.deleteMany({ where: { id: { startsWith: runId } } });
  await db.$disconnect();
});

describe("applyAiDesign against Postgres", () => {
  it("writes the whole design in one go, marks the generation used and leaves AI files alone", async () => {
    const eventId = await createEvent();
    const genId = await seedGeneration(eventId);
    store.set(`certificate-backgrounds/events/${eventId}/aaaaaaaaaaaaaaaa.png`, original);

    expect(await applyAiDesign(eventId, genId, null, {}, db)).toEqual({ ok: true });

    const config = await db.certificateConfig.findUniqueOrThrow({ where: { eventId } });
    expect(config).toMatchObject({ templateSource: "UPLOAD", aiGenerationId: genId, pageHeight: 595.28 });
    expect(isBackgroundPathFor(eventId, config.backgroundPath ?? "")).toBe(true);
    expect(parseCertificateLayout(config.layout)).toEqual(toCertificateLayout(brief, parseCertificateLayout({}), 1));
    expect(parseCertificateLayout(config.layout).inkColor).toBe("#123456");
    expect((await db.aiGeneration.findUniqueOrThrow({ where: { id: genId } })).firstUsedAt).not.toBeNull();

    expect(cert("certificate-backgrounds", eventId)).toEqual([`certificate-backgrounds/${config.backgroundPath}`]);
    expect(cert("ai-generations", eventId)).toHaveLength(3);
  });

  it("swaps only the background when the same generation is applied again, keeping organizer edits and quota", async () => {
    const eventId = await createEvent();
    const genId = await seedGeneration(eventId);
    expect(await applyAiDesign(eventId, genId, null, {}, db)).toEqual({ ok: true });
    const first = await db.certificateConfig.findUniqueOrThrow({ where: { eventId } });

    const edited = parseCertificateLayout(first.layout);
    edited.recipientName.y = 0.61;
    await db.certificateConfig.update({ where: { eventId }, data: { layout: edited } });
    const before = await countEventKind(db, eventId, "CERTIFICATE");

    expect(await applyAiDesign(eventId, genId, logoPathOf(eventId), {}, db)).toEqual({ ok: true });
    const second = await db.certificateConfig.findUniqueOrThrow({ where: { eventId } });
    expect(second.backgroundPath).not.toBe(first.backgroundPath);
    expect(parseCertificateLayout(second.layout).recipientName.y).toBe(0.61);
    expect(cert("certificate-backgrounds", eventId)).toHaveLength(1);
    expect(await countEventKind(db, eventId, "CERTIFICATE")).toBe(before);
    expect(await db.aiGeneration.count({ where: { eventId } })).toBe(1);

    expect(await applyAiDesign(eventId, genId, null, {}, db)).toEqual({ ok: true });
    expect(cert("certificate-backgrounds", eventId)).toHaveLength(1);
  });

  it("asks for confirmation before replacing another design and recomputes the layout for a different generation", async () => {
    const eventId = await createEvent();
    const a = await seedGeneration(eventId);
    const b = await seedGeneration(eventId);
    expect(await applyAiDesign(eventId, a, null, {}, db)).toEqual({ ok: true });
    const edited = parseCertificateLayout((await db.certificateConfig.findUniqueOrThrow({ where: { eventId } })).layout);
    edited.recipientName.y = 0.61;
    await db.certificateConfig.update({ where: { eventId }, data: { layout: edited } });

    expect(await applyAiDesign(eventId, b, null, {}, db)).toMatchObject({ ok: false, reason: "NEEDS_CONFIRM" });
    expect(cert("certificate-backgrounds", eventId)).toHaveLength(1);
    expect((await db.aiGeneration.findUniqueOrThrow({ where: { id: b } })).firstUsedAt).toBeNull();

    expect(await applyAiDesign(eventId, b, null, { confirmReplace: true }, db)).toEqual({ ok: true });
    const config = await db.certificateConfig.findUniqueOrThrow({ where: { eventId } });
    expect(config.aiGenerationId).toBe(b);
    expect(parseCertificateLayout(config.layout).recipientName.y).not.toBe(0.61);
  });

  it("refuses a locked design and cleans up the copied file without marking the generation used", async () => {
    const eventId = await createEvent();
    const genId = await seedGeneration(eventId);
    await getOrCreateCertificateConfig(eventId, db);
    await db.certificateConfig.update({ where: { eventId }, data: { lockedAt: new Date() } });

    expect(await applyAiDesign(eventId, genId, null, {}, db)).toMatchObject({ ok: false, reason: "LOCKED" });
    expect(cert("certificate-backgrounds", eventId)).toEqual([]);
    expect((await db.aiGeneration.findUniqueOrThrow({ where: { id: genId } })).firstUsedAt).toBeNull();
    expect((await db.certificateConfig.findUniqueOrThrow({ where: { eventId } })).templateSource).toBe("BUILTIN");
  });

  it("rolls back and removes the file when the lock lands after the early check", async () => {
    const eventId = await createEvent();
    const genId = await seedGeneration(eventId);
    await getOrCreateCertificateConfig(eventId, db);
    const originalFind = db.certificateConfig.findUnique.bind(db.certificateConfig);
    let locked = false;
    const racing = Object.create(db) as PrismaClient;
    Object.defineProperty(racing, "certificateConfig", {
      value: new Proxy(db.certificateConfig, {
        get(target, prop, receiver) {
          if (prop === "findUnique") {
            return async (args: never) => {
              const result = await originalFind(args);
              if (!locked) {
                locked = true;
                await db.certificateConfig.update({ where: { eventId }, data: { lockedAt: new Date() } });
              }
              return result;
            };
          }
          return Reflect.get(target, prop, receiver);
        },
      }),
    });

    const result = await applyAiDesign(eventId, genId, null, {}, racing);
    expect(result).toMatchObject({ ok: false, reason: "LOCKED" });
    expect(cert("certificate-backgrounds", eventId)).toEqual([]);
    expect((await db.aiGeneration.findUniqueOrThrow({ where: { id: genId } })).firstUsedAt).toBeNull();
  });

  it("rejects a logo that belongs to another event and a generation of another event", async () => {
    const eventId = await createEvent();
    const otherEvent = await createEvent();
    const genId = await seedGeneration(eventId);
    const otherGen = await seedGeneration(otherEvent);

    expect(await applyAiDesign(eventId, genId, logoPathOf(otherEvent), {}, db)).toMatchObject({ ok: false, reason: "INVALID" });
    expect(await applyAiDesign(eventId, otherGen, null, {}, db)).toMatchObject({ ok: false, reason: "NOT_AVAILABLE" });
    expect(cert("certificate-backgrounds", eventId)).toEqual([]);
  });

  it("refuses to apply a reported generation and refuses to report a used one", async () => {
    const eventId = await createEvent();
    const reported = await seedGeneration(eventId);
    const used = await seedGeneration(eventId);

    expect(await reportAiGeneration({ generationId: reported, eventId }, db)).toEqual({ ok: true });
    expect(await applyAiDesign(eventId, reported, null, {}, db)).toMatchObject({ ok: false, reason: "NOT_AVAILABLE" });

    expect(await applyAiDesign(eventId, used, null, { confirmReplace: true }, db)).toEqual({ ok: true });
    expect(await reportAiGeneration({ generationId: used, eventId }, db)).toMatchObject({ ok: false });
    expect(await countEventKind(db, eventId, "CERTIFICATE")).toBe(1);
  });

  it("lets only one of a parallel apply and report win", async () => {
    const eventId = await createEvent();
    const genId = await seedGeneration(eventId);

    const [applied, reported] = await Promise.all([
      applyAiDesign(eventId, genId, null, {}, db),
      reportAiGeneration({ generationId: genId, eventId }, db),
    ]);

    expect([applied.ok, reported.ok].filter(Boolean)).toHaveLength(1);
    const row = await db.aiGeneration.findUniqueOrThrow({ where: { id: genId } });
    expect(Boolean(row.reportedAt) && Boolean(row.firstUsedAt)).toBe(false);
    if (!applied.ok) expect(cert("certificate-backgrounds", eventId)).toEqual([]);
  });
});
