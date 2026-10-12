import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { AI_UNAVAILABLE_MESSAGE, estimateGenerationMicros, type AiLimits } from "@/lib/ai-config";
import { getAiAccess } from "@/server/ai-access";
import { addAiAllowlist, removeAiAllowlist } from "@/server/ai-allowlist";
import { countGlobalToday, monthlySpendMicros, reserveGeneration } from "@/server/ai-quota";
import { reportAiGeneration } from "@/server/ai-report";

const runId = `itai${Date.now()}`;
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 6 }) });
const DAY = 86_400_000;
const EST = estimateGenerationMicros();

const organizerId = `${runId}-org`;
const eventIds: string[] = [];
let counter = 0;

const roomyLimits: AiLimits = {
  monthlyCapUsd: 1_000_000,
  trialCapUsd: 1_000_000,
  trialEndsOn: null,
  globalDailyLimit: 1_000_000,
};

async function createUser(suffix: string, role: "ORGANIZER" | "PARTICIPANT" = "ORGANIZER", withProfile = true) {
  const id = `${runId}-${suffix}`;
  await db.user.create({ data: { id, name: `Akun ${id}`, email: `${id}@test.test`, emailVerified: true, role } });
  if (role === "ORGANIZER" && withProfile) {
    await db.organizerProfile.create({ data: { userId: id, orgName: `Org ${id}`, contactPhone: "0811" } });
  }
  return id;
}

async function createEvent(status: "DRAFT" | "PUBLISHED" | "CANCELLED" | "DISABLED" = "PUBLISHED", owner = organizerId) {
  counter += 1;
  const event = await db.event.create({
    data: {
      organizerId: owner,
      slug: `${runId}-e${counter}`,
      title: `Acara ${runId} ${counter}`,
      description: "x",
      startAt: new Date(Date.now() + DAY),
      endAt: new Date(Date.now() + DAY + 3_600_000),
      venueName: "Test",
      status,
    },
  });
  eventIds.push(event.id);
  return event.id;
}

function reserve(eventId: string, userId: string, limits: AiLimits = roomyLimits, kind: "CERTIFICATE" | "POSTER" = "CERTIFICATE") {
  return reserveGeneration(
    { eventId, userId, kind, input: { style: "minimal", hasLogo: false }, promptVersion: "test" },
    { db, limits },
  );
}

function seed(userId: string, eventId: string | null, status: "SUCCEEDED" | "FAILED" | "RUNNING", count = 1, kind: "CERTIFICATE" | "POSTER" = "CERTIFICATE") {
  return db.aiGeneration.createMany({
    data: Array.from({ length: count }, () => ({
      userId,
      eventId,
      kind,
      status,
      input: { style: "minimal", hasLogo: false },
      promptVersion: "test",
    })),
  });
}

async function seedOne(userId: string, eventId: string, status: "SUCCEEDED" | "FAILED" = "SUCCEEDED") {
  return db.aiGeneration.create({
    data: { userId, eventId, kind: "CERTIFICATE", status, input: { style: "minimal" }, promptVersion: "test" },
  });
}

const passed = (results: Awaited<ReturnType<typeof reserve>>[]) => results.filter((result) => result.ok).length;

beforeAll(async () => {
  await createUser("org");
});

afterAll(async () => {
  await db.certificateConfig.deleteMany({ where: { eventId: { in: eventIds } } });
  await db.aiGeneration.deleteMany({ where: { userId: { startsWith: runId } } });
  await db.auditLog.deleteMany({ where: { entityId: { startsWith: runId } } });
  await db.event.deleteMany({ where: { id: { in: eventIds } } });
  await db.organizerProfile.deleteMany({ where: { userId: { startsWith: runId } } });
  await db.user.deleteMany({ where: { id: { startsWith: runId } } });
  await db.$disconnect();
});

describe("migration structure", () => {
  it("keeps the raw partial unique indexes", async () => {
    const rows = await db.$queryRaw<{ indexname: string; indexdef: string }[]>`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'ai_generations'`;
    const byName = new Map(rows.map((row) => [row.indexname, row.indexdef]));

    const running = byName.get("ai_generations_one_running_per_event_idx");
    expect(running).toMatch(/CREATE UNIQUE INDEX/);
    expect(running).toMatch(/\(event_id\)/);
    expect(running).toMatch(/WHERE .*status.* = 'RUNNING'/);

    const report = byName.get("ai_generations_one_report_per_event_kind_idx");
    expect(report).toMatch(/CREATE UNIQUE INDEX/);
    expect(report).toMatch(/\(event_id, kind\)/);
    expect(report).toMatch(/WHERE \(?reported_at IS NOT NULL\)?/);
  });

  it("enables row level security without policies on the new tables", async () => {
    const rows = await db.$queryRaw<{ relname: string; relrowsecurity: boolean }[]>`
      SELECT relname, relrowsecurity FROM pg_class
      WHERE relname IN ('ai_generations', 'ai_allowlist') AND relkind = 'r'`;
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.relrowsecurity)).toBe(true);

    const policies = await db.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM pg_policies WHERE tablename IN ('ai_generations', 'ai_allowlist')`;
    expect(Number(policies[0].n)).toBe(0);
  });

  it("rejects a second RUNNING row for the same event at the database level", async () => {
    const user = await createUser("idx-running");
    const eventId = await createEvent("PUBLISHED", user);
    await seed(user, eventId, "RUNNING");
    await expect(seed(user, eventId, "RUNNING")).rejects.toThrow();
  });
});

describe("reserveGeneration per event and kind", () => {
  it("lets exactly 3 reservations through across parallel waves of 20", async () => {
    const user = await createUser("limit3");
    const eventId = await createEvent("PUBLISHED", user);
    let total = 0;

    for (let wave = 0; wave < 4; wave += 1) {
      const results = await Promise.all(Array.from({ length: 20 }, () => reserve(eventId, user)));
      const winners = results.filter((result) => result.ok);
      total += winners.length;
      expect(winners.length).toBe(wave < 3 ? 1 : 0);
      if (winners[0]?.ok) {
        await db.aiGeneration.update({ where: { id: winners[0].generationId }, data: { status: "SUCCEEDED" } });
      }
    }

    expect(total).toBe(3);
    const denied = await reserve(eventId, user);
    expect(denied).toMatchObject({ ok: false, reason: "EVENT_LIMIT" });
  });

  it("keeps a single RUNNING row per event under 20 parallel reservations", async () => {
    const user = await createUser("single-run");
    const eventId = await createEvent("PUBLISHED", user);
    const results = await Promise.all(Array.from({ length: 20 }, () => reserve(eventId, user)));

    expect(passed(results)).toBe(1);
    expect(results.filter((result) => !result.ok).every((result) => !result.ok && result.reason === "EVENT_RUNNING")).toBe(true);
    expect(await db.aiGeneration.count({ where: { eventId, status: "RUNNING" } })).toBe(1);
  });

  it("does not count failed rows and counts kinds separately", async () => {
    const user = await createUser("kinds");
    const eventId = await createEvent("PUBLISHED", user);
    await seed(user, eventId, "FAILED", 5);
    await seed(user, eventId, "SUCCEEDED", 3);

    expect(await reserve(eventId, user)).toMatchObject({ ok: false, reason: "EVENT_LIMIT" });
    expect(await reserve(eventId, user, roomyLimits, "POSTER")).toMatchObject({ ok: true });
  });

  it("is idempotent for the same key", async () => {
    const user = await createUser("idem");
    const eventId = await createEvent("PUBLISHED", user);
    const input = { eventId, userId: user, kind: "CERTIFICATE" as const, input: { style: "x" }, promptVersion: "test", idempotencyKey: "k1" };
    const first = await reserveGeneration(input, { db, limits: roomyLimits });
    const second = await reserveGeneration(input, { db, limits: roomyLimits });

    expect(first).toMatchObject({ ok: true, reused: false });
    expect(second).toMatchObject({ ok: true, reused: true });
    expect(first.ok && second.ok && first.generationId === second.generationId).toBe(true);
  });
});

describe("reserveGeneration idempotency scope", () => {
  it("refuses a key that belongs to another event or kind", async () => {
    const user = await createUser("idem-scope");
    const eventA = await createEvent("PUBLISHED", user);
    const eventB = await createEvent("PUBLISHED", user);
    const base = { userId: user, input: { style: "x" }, promptVersion: "test", idempotencyKey: "shared" };
    const first = await reserveGeneration({ ...base, eventId: eventA, kind: "CERTIFICATE" }, { db, limits: roomyLimits });
    expect(first).toMatchObject({ ok: true });

    expect(await reserveGeneration({ ...base, eventId: eventB, kind: "CERTIFICATE" }, { db, limits: roomyLimits })).toMatchObject({
      ok: false,
      reason: "IDEMPOTENCY_MISMATCH",
    });
    expect(await reserveGeneration({ ...base, eventId: eventA, kind: "POSTER" }, { db, limits: roomyLimits })).toMatchObject({
      ok: false,
      reason: "IDEMPOTENCY_MISMATCH",
    });
    expect(await db.aiGeneration.count({ where: { eventId: eventB } })).toBe(0);
  });
});

describe("reserveGeneration other limits", () => {
  it("caps an account at 15 per WIB day across events under parallel load", async () => {
    const user = await createUser("daily");
    await seed(user, null, "SUCCEEDED", 13);
    const events = await Promise.all(Array.from({ length: 20 }, () => createEvent("PUBLISHED", user)));

    const results = await Promise.all(events.map((eventId) => reserve(eventId, user)));

    expect(passed(results)).toBe(2);
    expect(results.filter((result) => !result.ok).every((result) => !result.ok && result.reason === "DAILY_LIMIT")).toBe(true);
  });

  it("never exceeds a thin monthly cap under parallel load", async () => {
    const baseline = await monthlySpendMicros(db, new Date());
    const limits = { ...roomyLimits, monthlyCapUsd: (baseline + EST * 2.5) / 1_000_000, trialCapUsd: 1_000_000 };
    const users = await Promise.all(Array.from({ length: 10 }, (_, index) => createUser(`cap${index}`)));
    const events = await Promise.all(users.map((user) => createEvent("PUBLISHED", user)));

    const results = await Promise.all(events.map((eventId, index) => reserve(eventId, users[index], limits)));

    expect(passed(results)).toBe(2);
    expect(results.filter((result) => !result.ok).every((result) => !result.ok && result.reason === "CAP")).toBe(true);
  });

  it("uses the trial cap before AI_TRIAL_ENDS_ON and the normal cap after", async () => {
    const baseline = await monthlySpendMicros(db, new Date());
    const thin = (baseline + EST * 0.5) / 1_000_000;
    const user = await createUser("trial");
    const eventId = await createEvent("PUBLISHED", user);

    const trialActive = { ...roomyLimits, monthlyCapUsd: thin, trialCapUsd: 1_000_000, trialEndsOn: "2999-01-01" };
    const trialOver = { ...trialActive, trialEndsOn: "2000-01-01" };

    expect(await reserve(eventId, user, trialOver)).toMatchObject({ ok: false, reason: "CAP" });
    expect(await reserve(eventId, user, trialActive)).toMatchObject({ ok: true });
  });

  it("enforces the global daily application limit under parallel load", async () => {
    const baseline = await countGlobalToday(db, new Date());
    const limits = { ...roomyLimits, globalDailyLimit: baseline + 3 };
    const users = await Promise.all(Array.from({ length: 10 }, (_, index) => createUser(`glob${index}`)));
    const events = await Promise.all(users.map((user) => createEvent("PUBLISHED", user)));

    const results = await Promise.all(events.map((eventId, index) => reserve(eventId, users[index], limits)));

    expect(passed(results)).toBe(3);
    expect(results.filter((result) => !result.ok).every((result) => !result.ok && result.reason === "GLOBAL_DAILY")).toBe(true);
  });

  it("rejects closed events and locked certificate designs", async () => {
    const user = await createUser("closed");
    const disabled = await createEvent("DISABLED", user);
    const cancelled = await createEvent("CANCELLED", user);
    const locked = await createEvent("PUBLISHED", user);
    const draft = await createEvent("DRAFT", user);
    await db.certificateConfig.create({
      data: { eventId: locked, builtinKey: "classic", pageWidth: 842, pageHeight: 595, layout: {}, lockedAt: new Date() },
    });

    expect(await reserve(disabled, user)).toMatchObject({ ok: false, reason: "EVENT_CLOSED" });
    expect(await reserve(cancelled, user)).toMatchObject({ ok: false, reason: "EVENT_CLOSED" });
    expect(await reserve(locked, user)).toMatchObject({ ok: false, reason: "LOCKED" });
    expect(await reserve(locked, user, roomyLimits, "POSTER")).toMatchObject({ ok: true });
    expect(await reserve(draft, user)).toMatchObject({ ok: true });
  });

  it("sweeps stale RUNNING rows to FAILED/STALE and frees the event", async () => {
    const user = await createUser("stale");
    const eventId = await createEvent("PUBLISHED", user);
    const stale = await db.aiGeneration.create({
      data: {
        userId: user,
        eventId,
        kind: "CERTIFICATE",
        status: "RUNNING",
        input: {},
        promptVersion: "test",
        estCostMicros: EST,
        startedAt: new Date(Date.now() - 10 * 60_000),
      },
    });

    const result = await reserve(eventId, user);
    const swept = await db.aiGeneration.findUniqueOrThrow({ where: { id: stale.id } });

    expect(result).toMatchObject({ ok: true });
    expect(swept).toMatchObject({ status: "FAILED", failureCode: "STALE", costMicros: stale.estCostMicros });
    expect(swept.costMicros).toBeGreaterThan(0);
    expect(swept.finishedAt).not.toBeNull();
  });
});

describe("reportAiGeneration", () => {
  it("lets exactly one of two parallel reports on the same generation win", async () => {
    const user = await createUser("rep-same");
    const eventId = await createEvent("PUBLISHED", user);
    const generation = await seedOne(user, eventId);

    const results = await Promise.all([
      reportAiGeneration({ generationId: generation.id, eventId }, db),
      reportAiGeneration({ generationId: generation.id, eventId }, db),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(await db.aiGeneration.count({ where: { eventId, reportedAt: { not: null } } })).toBe(1);
  });

  it("lets exactly one report per event and kind across different generations", async () => {
    const user = await createUser("rep-diff");
    const eventId = await createEvent("PUBLISHED", user);
    const [a, b] = await Promise.all([seedOne(user, eventId), seedOne(user, eventId)]);

    const results = await Promise.all([
      reportAiGeneration({ generationId: a.id, eventId }, db),
      reportAiGeneration({ generationId: b.id, eventId }, db),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.find((result) => !result.ok)).toMatchObject({ ok: false, reason: "REPORT_USED" });
  });

  it("is backed by the unique index even when the explicit check is bypassed", async () => {
    const user = await createUser("rep-index");
    const eventId = await createEvent("PUBLISHED", user);
    const [a, b] = await Promise.all([seedOne(user, eventId), seedOne(user, eventId)]);

    await db.aiGeneration.update({ where: { id: a.id }, data: { reportedAt: new Date() } });
    await expect(db.aiGeneration.update({ where: { id: b.id }, data: { reportedAt: new Date() } })).rejects.toThrow();
  });

  it("refuses used, failed, foreign-event and unknown generations", async () => {
    const user = await createUser("rep-deny");
    const eventId = await createEvent("PUBLISHED", user);
    const otherEvent = await createEvent("PUBLISHED", user);
    const used = await seedOne(user, eventId);
    await db.aiGeneration.update({ where: { id: used.id }, data: { firstUsedAt: new Date() } });
    const failed = await seedOne(user, eventId, "FAILED");
    const fine = await seedOne(user, eventId);

    expect(await reportAiGeneration({ generationId: used.id, eventId }, db)).toMatchObject({ ok: false, reason: "NOT_AVAILABLE" });
    expect(await reportAiGeneration({ generationId: failed.id, eventId }, db)).toMatchObject({ ok: false, reason: "NOT_AVAILABLE" });
    expect(await reportAiGeneration({ generationId: fine.id, eventId: otherEvent }, db)).toMatchObject({ ok: false, reason: "NOT_AVAILABLE" });
    expect(await reportAiGeneration({ generationId: `${runId}-none`, eventId }, db)).toMatchObject({ ok: false, reason: "NOT_AVAILABLE" });
  });

  it("returns the quota after a report", async () => {
    const user = await createUser("rep-quota");
    const eventId = await createEvent("PUBLISHED", user);
    const first = await seedOne(user, eventId);
    await seed(user, eventId, "SUCCEEDED", 2);

    expect(await reserve(eventId, user)).toMatchObject({ ok: false, reason: "EVENT_LIMIT" });
    expect(await reportAiGeneration({ generationId: first.id, eventId }, db)).toEqual({ ok: true });
    expect(await reserve(eventId, user)).toMatchObject({ ok: true });
  });
});

describe("getAiAccess", () => {
  it("answers the same message for a disabled flag and for an account outside the allowlist", async () => {
    const allowed = await createUser("acc-allowed");
    const outsider = await createUser("acc-outsider");
    await addAiAllowlist({ email: `${allowed}@test.test`, actorId: organizerId }, db);

    const flagOff = await getAiAccess({ id: allowed }, null, { db, enabled: false, limits: roomyLimits });
    const notListed = await getAiAccess({ id: outsider }, null, { db, enabled: true, limits: roomyLimits });
    const listed = await getAiAccess({ id: allowed }, null, { db, enabled: true, limits: roomyLimits });

    expect(flagOff).toEqual({ status: "HIDDEN", message: AI_UNAVAILABLE_MESSAGE });
    expect(notListed).toEqual(flagOff);
    expect(listed).toEqual({ status: "AVAILABLE", remaining: null });
  });

  it("reflects cap, event state, lock, event quota and daily quota", async () => {
    const user = await createUser("acc-ctx");
    await addAiAllowlist({ email: `${user}@test.test`, actorId: organizerId }, db);
    const options = { db, enabled: true, limits: roomyLimits };
    const eventId = await createEvent("PUBLISHED", user);
    const disabled = await createEvent("DISABLED", user);
    const locked = await createEvent("PUBLISHED", user);
    await db.certificateConfig.create({
      data: { eventId: locked, builtinKey: "classic", pageWidth: 842, pageHeight: 595, layout: {}, lockedAt: new Date() },
    });
    const baseline = await monthlySpendMicros(db, new Date());

    expect(await getAiAccess({ id: user }, { eventId, kind: "CERTIFICATE" }, options)).toEqual({ status: "AVAILABLE", remaining: 3 });
    expect(await getAiAccess({ id: user }, { eventId: disabled, kind: "CERTIFICATE" }, options)).toMatchObject({ status: "HIDDEN", message: AI_UNAVAILABLE_MESSAGE });
    expect(await getAiAccess({ id: user }, { eventId: locked, kind: "CERTIFICATE" }, options)).toMatchObject({ status: "LOCKED" });
    expect(await getAiAccess({ id: user }, { eventId: locked, kind: "POSTER" }, options)).toMatchObject({ status: "AVAILABLE" });
    expect(
      await getAiAccess({ id: user }, null, { ...options, limits: { ...roomyLimits, monthlyCapUsd: (baseline + EST / 2) / 1_000_000, trialCapUsd: 1 } }),
    ).toMatchObject({ status: "PAUSED" });

    await seed(user, eventId, "SUCCEEDED", 3);
    expect(await getAiAccess({ id: user }, { eventId, kind: "CERTIFICATE" }, options)).toMatchObject({ status: "QUOTA" });

    await seed(user, null, "SUCCEEDED", 12);
    const another = await createEvent("PUBLISHED", user);
    expect(await getAiAccess({ id: user }, { eventId: another, kind: "CERTIFICATE" }, options)).toMatchObject({ status: "DAILY" });
  });
});

describe("ai allowlist", () => {
  it("adds organizers with an audit log, rejects others, and removes with an audit log", async () => {
    const organizer = await createUser("al-org");
    const participant = await createUser("al-part", "PARTICIPANT");
    const noProfile = await createUser("al-noprof", "ORGANIZER", false);

    expect(await addAiAllowlist({ email: `${participant}@test.test`, actorId: organizerId }, db)).toEqual({ ok: false, reason: "NOT_ORGANIZER" });
    expect(await addAiAllowlist({ email: `${noProfile}@test.test`, actorId: organizerId }, db)).toEqual({ ok: false, reason: "NOT_ORGANIZER" });
    expect(await addAiAllowlist({ email: `${runId}-ghost@test.test`, actorId: organizerId }, db)).toEqual({ ok: false, reason: "NOT_ORGANIZER" });

    expect(await addAiAllowlist({ email: `${organizer}@test.test`, actorId: organizerId }, db)).toEqual({ ok: true, userId: organizer });
    expect(await addAiAllowlist({ email: `${organizer}@test.test`, actorId: organizerId }, db)).toEqual({ ok: false, reason: "ALREADY_ALLOWED" });
    expect(await db.auditLog.count({ where: { entityId: organizer, action: "ai.allowlist.add" } })).toBe(1);

    expect(await removeAiAllowlist({ userId: organizer, actorId: organizerId }, db)).toEqual({ ok: true });
    expect(await removeAiAllowlist({ userId: organizer, actorId: organizerId }, db)).toEqual({ ok: false, reason: "NOT_ALLOWED" });
    expect(await db.auditLog.count({ where: { entityId: organizer, action: "ai.allowlist.remove" } })).toBe(1);
    expect(await db.aiAllowlist.count({ where: { userId: organizer } })).toBe(0);
  });

  it("handles two parallel adds of the same account with exactly one success", async () => {
    const organizer = await createUser("al-race");
    const results = await Promise.all([
      addAiAllowlist({ email: `${organizer}@test.test`, actorId: organizerId }, db),
      addAiAllowlist({ email: `${organizer}@test.test`, actorId: organizerId }, db),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(await db.auditLog.count({ where: { entityId: organizer, action: "ai.allowlist.add" } })).toBe(1);
  });
});
