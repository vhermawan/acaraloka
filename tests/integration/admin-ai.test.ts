import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import type { AiLimits } from "@/lib/ai-config";
import { getAdminAiSummary, listAiAllowlist, listRecentAiGenerations } from "@/server/admin-ai";
import { addAiAllowlist } from "@/server/ai-allowlist";

const runId = `itaa${Date.now()}`;
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 2 }) });

const organizerId = `${runId}-org`;
const otherId = `${runId}-other`;
const eventIds: string[] = [];

const now = new Date("2099-03-15T03:00:00Z");
const insideMonth = new Date("2099-02-28T17:30:00Z");
const beforeMonth = new Date("2099-02-28T16:30:00Z");

const roomy: AiLimits = { monthlyCapUsd: 1_000_000, trialCapUsd: 1_000_000, trialEndsOn: null, globalDailyLimit: 5 };

async function createOrganizer(id: string) {
  await db.user.create({ data: { id, name: `Akun ${id}`, email: `${id}@test.test`, emailVerified: true, role: "ORGANIZER" } });
  await db.organizerProfile.create({ data: { userId: id, orgName: `Org ${id}`, contactPhone: "0811" } });
}

function generation(createdAt: Date, extra: Record<string, unknown> = {}) {
  return db.aiGeneration.create({
    data: {
      userId: organizerId,
      eventId: eventIds[0],
      kind: "CERTIFICATE",
      status: "SUCCEEDED",
      input: { style: "minimal" },
      promptVersion: "test",
      purgedAt: createdAt,
      createdAt,
      ...extra,
    },
  });
}

beforeAll(async () => {
  await createOrganizer(organizerId);
  await createOrganizer(otherId);
  const event = await db.event.create({
    data: {
      organizerId,
      slug: `${runId}-e`,
      title: `Acara ${runId}`,
      description: "x",
      startAt: new Date(Date.now() + 86_400_000),
      endAt: new Date(Date.now() + 90_000_000),
      venueName: "Test",
      status: "PUBLISHED",
    },
  });
  eventIds.push(event.id);

  await generation(beforeMonth, { costMicros: 900_000 });
  await generation(insideMonth, { costMicros: 100_000, status: "FAILED", failureCode: "VENDOR_ERROR" });
  await generation(new Date("2099-03-10T05:00:00Z"), { costMicros: 200_000, firstUsedAt: new Date("2099-03-10T06:00:00Z") });
  await generation(new Date("2099-03-15T01:00:00Z"), { costMicros: 300_000, reportedAt: new Date("2099-03-15T02:00:00Z") });
});

afterAll(async () => {
  await db.aiAllowlist.deleteMany({ where: { userId: { startsWith: runId } } });
  await db.aiGeneration.deleteMany({ where: { userId: { startsWith: runId } } });
  await db.auditLog.deleteMany({ where: { entityId: { startsWith: runId } } });
  await db.event.deleteMany({ where: { id: { in: eventIds } } });
  await db.organizerProfile.deleteMany({ where: { userId: { startsWith: runId } } });
  await db.user.deleteMany({ where: { id: { startsWith: runId } } });
  await db.$disconnect();
});

describe("getAdminAiSummary", () => {
  it("sums cost from the start of the WIB month only", async () => {
    const summary = await getAdminAiSummary({ db, now, limits: { ...roomy, monthlyCapUsd: 10 }, enabled: true });
    expect(summary.spentUsd).toBeCloseTo(0.6, 6);
    expect(summary.capUsd).toBe(10);
    expect(summary.spentPercent).toBeCloseTo(6, 4);
    expect(summary.status).toBe("ACTIVE");
    expect(summary.trial).toBe(false);
  });

  it("counts today's generations in WIB against the daily limit", async () => {
    const summary = await getAdminAiSummary({ db, now, limits: roomy, enabled: true });
    expect(summary.todayCount).toBe(1);
    expect(summary.globalDailyLimit).toBe(5);
  });

  it("reports DISABLED when the flag is off even if the cap is reached", async () => {
    const summary = await getAdminAiSummary({ db, now, limits: { ...roomy, monthlyCapUsd: 0.5 }, enabled: false });
    expect(summary.status).toBe("DISABLED");
  });

  it("reports PAUSED when the monthly cap is reached", async () => {
    const summary = await getAdminAiSummary({ db, now, limits: { ...roomy, monthlyCapUsd: 0.5 }, enabled: true });
    expect(summary.status).toBe("PAUSED");
  });

  it("uses the trial cap and exposes the trial end date before it ends", async () => {
    const limits = { ...roomy, monthlyCapUsd: 10, trialCapUsd: 30, trialEndsOn: "2099-04-01" };
    const summary = await getAdminAiSummary({ db, now, limits, enabled: true });
    expect(summary.trial).toBe(true);
    expect(summary.capUsd).toBe(30);
    expect(summary.trialEndsOn).toBe("2099-04-01");

    const after = await getAdminAiSummary({ db, now, limits: { ...limits, trialEndsOn: "2099-03-15" }, enabled: true });
    expect(after.trial).toBe(false);
    expect(after.capUsd).toBe(10);
  });
});

describe("listRecentAiGenerations", () => {
  it("returns newest first with account, event, used and reported flags", async () => {
    const rows = (await listRecentAiGenerations(db)).filter((row) => row.userEmail.startsWith(runId));
    expect(rows.map((row) => row.costUsd)).toEqual([0.3, 0.2, 0.1, 0.9]);
    expect(rows[0]).toMatchObject({ reported: true, used: false, eventTitle: `Acara ${runId}`, thumbUrl: null });
    expect(rows[1]).toMatchObject({ used: true, reported: false });
    expect(rows[2]).toMatchObject({ status: "FAILED", failureCode: "VENDOR_ERROR" });
  });

  it("never returns more than 50 rows", async () => {
    expect((await listRecentAiGenerations(db)).length).toBeLessThanOrEqual(50);
  });
});

describe("listAiAllowlist", () => {
  it("lists name, email, date and generation count", async () => {
    await addAiAllowlist({ email: `${organizerId}@test.test`, actorId: organizerId }, db);
    await addAiAllowlist({ email: `${otherId}@test.test`, actorId: organizerId }, db);
    const rows = (await listAiAllowlist(db)).filter((row) => row.userId.startsWith(runId));
    const first = rows.find((row) => row.userId === organizerId);
    const second = rows.find((row) => row.userId === otherId);
    expect(first).toMatchObject({ name: `Akun ${organizerId}`, email: `${organizerId}@test.test`, generationCount: 4 });
    expect(second?.generationCount).toBe(0);
    expect(first?.createdAt).toBeInstanceOf(Date);
  });
});
