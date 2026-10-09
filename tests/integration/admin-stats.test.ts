import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { bucketStart, jakartaDayKey, jakartaWeekKey } from "@/lib/admin-stats";
import { getAdminStats } from "@/server/admin-stats";

const runId = `itas${Date.now()}`;
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 2 }) });
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const now = new Date();
const ago = (ms: number) => new Date(now.getTime() - ms);

const organizerId = `${runId}-org`;
const participantId = `${runId}-peserta`;
const adminId = `${runId}-admin`;
const eventIds: string[] = [];

type Stats = Awaited<ReturnType<typeof getAdminStats>>;

function count(series: Stats["registrationsDaily"], key: string) {
  return series.find((point) => point.key === key)?.count ?? 0;
}

async function createEvent(suffix: string, status: "DRAFT" | "PUBLISHED" | "CANCELLED" | "DISABLED", publishedAt: Date | null) {
  const event = await db.event.create({
    data: {
      organizerId,
      slug: `${runId}-${suffix}`,
      title: `Acara ${suffix} ${runId}`,
      description: "x",
      startAt: new Date(now.getTime() + DAY),
      endAt: new Date(now.getTime() + 2 * DAY),
      venue: "Test",
      status,
      publishedAt,
      ticketTypes: { create: { name: "Umum", quota: 50 } },
    },
    include: { ticketTypes: true },
  });
  eventIds.push(event.id);
  return { id: event.id, ticketTypeId: event.ticketTypes[0].id };
}

let regCounter = 0;
function registration(event: { id: string; ticketTypeId: string }, createdAt: Date, extra: Record<string, unknown> = {}) {
  regCounter += 1;
  return db.registration.create({
    data: {
      eventId: event.id,
      ticketTypeId: event.ticketTypeId,
      userId: `${runId}-reg${regCounter}`,
      name: "Peserta",
      email: `${runId}-${regCounter}@test.test`,
      phone: "081234567890",
      consentAt: createdAt,
      createdAt,
      ...extra,
    },
  });
}

let before: Stats;
let after: Stats;

const todayKey = jakartaDayKey(now);
const midnightToday = bucketStart(todayKey);
const thisWeekKey = jakartaWeekKey(now);
const thisWeekStart = bucketStart(thisWeekKey);
const previousWeekKey = jakartaWeekKey(new Date(thisWeekStart.getTime() - 1));
const yesterdayKey = jakartaDayKey(new Date(midnightToday.getTime() - 1));

beforeAll(async () => {
  before = await getAdminStats(now, db);
  await db.user.createMany({
    data: [
      { id: organizerId, name: `Panitia ${runId}`, email: `${organizerId}@test.test`, emailVerified: true, role: "ORGANIZER", createdAt: thisWeekStart },
      { id: participantId, name: `Peserta ${runId}`, email: `${participantId}@test.test`, emailVerified: true, createdAt: new Date(thisWeekStart.getTime() - 1) },
      { id: adminId, name: `Admin ${runId}`, email: `${adminId}@test.test`, emailVerified: true, role: "ADMIN", createdAt: thisWeekStart, disabledAt: now },
    ],
  });
  await db.user.createMany({
    data: Array.from({ length: 6 }, (_, index) => ({
      id: `${runId}-reg${index + 1}`,
      name: `Peserta ${index + 1} ${runId}`,
      email: `${runId}-reg${index + 1}@test.test`,
      emailVerified: true,
      createdAt: ago(400 * DAY),
    })),
  });
  await db.organizerProfile.create({ data: { userId: organizerId, orgName: `Org ${runId}`, contactPhone: "081234567890" } });


  const published = await createEvent("terbit", "PUBLISHED", thisWeekStart);
  await createEvent("terbit-lama", "PUBLISHED", new Date(thisWeekStart.getTime() - 1));
  await createEvent("draf", "DRAFT", null);
  await createEvent("batal", "CANCELLED", ago(200 * DAY));
  await createEvent("nonaktif", "DISABLED", ago(100 * DAY));

  const r1 = await registration(published, ago(HOUR), { checkedInAt: ago(HOUR) });
  const r2 = await registration(published, ago(3 * DAY), { checkedInAt: ago(2 * DAY) });
  await registration(published, ago(10 * DAY), { status: "CANCELLED", cancelledAt: ago(9 * DAY) });
  await registration(published, ago(40 * DAY));
  await registration(published, midnightToday);
  await registration(published, new Date(midnightToday.getTime() - 1));

  await db.certificate.createMany({
    data: [
      { eventId: published.id, registrationId: r1.id, seq: 1, number: `${runId}-1`, recipientName: "A" },
      { eventId: published.id, registrationId: r2.id, seq: 2, number: `${runId}-2`, recipientName: "B", revokedAt: now },
    ],
  });

  await db.errorLog.createMany({
    data: [
      { fingerprint: `${runId}-e1`, source: "test", level: "error", message: "x", count: 3, lastSeenAt: ago(HOUR) },
      { fingerprint: `${runId}-e2`, source: "test", level: "error", message: "x", count: 5, lastSeenAt: ago(30 * HOUR) },
    ],
  });

  await db.emailOutbox.createMany({
    data: [
      { to: `a@${runId}.test`, template: "x", priority: 1, status: "SENT", sentAt: ago(HOUR), dedupeKey: `${runId}:1` },
      { to: `b@${runId}.test`, template: "x", priority: 1, status: "SENT", sentAt: ago(30 * HOUR), dedupeKey: `${runId}:2` },
      { to: `c@${runId}.test`, template: "x", priority: 1, status: "PENDING", dedupeKey: `${runId}:3` },
    ],
  });

  after = await getAdminStats(now, db);
});

afterAll(async () => {
  await db.event.deleteMany({ where: { id: { in: eventIds } } });
  await db.registration.deleteMany({ where: { userId: { startsWith: runId } } });
  await db.errorLog.deleteMany({ where: { fingerprint: { startsWith: runId } } });
  await db.emailOutbox.deleteMany({ where: { dedupeKey: { startsWith: runId } } });
  await db.user.deleteMany({ where: { id: { startsWith: runId } } });
  await db.$disconnect();
});

describe("getAdminStats cards", () => {
  it("counts events per status", () => {
    expect(after.events.published - before.events.published).toBe(2);
    expect(after.events.draft - before.events.draft).toBe(1);
    expect(after.events.cancelled - before.events.cancelled).toBe(1);
    expect(after.events.disabled - before.events.disabled).toBe(1);
  });

  it("counts users by role, disabled included", () => {
    expect(after.users.participants - before.users.participants).toBe(7);
    expect(after.users.organizers - before.users.organizers).toBe(1);
    expect(after.users.admins - before.users.admins).toBe(1);
  });

  it("counts registrations over 24 hours and 7 days regardless of status", () => {
    expect(after.registrations24h - before.registrations24h).toBeGreaterThanOrEqual(1);
    expect(after.registrations7d - before.registrations7d).toBeGreaterThanOrEqual(2);
  });

  it("counts check-ins, unrevoked certificates, errors and emails", () => {
    expect(after.checkedInTotal - before.checkedInTotal).toBe(2);
    expect(after.checkedIn24h - before.checkedIn24h).toBe(1);
    expect(after.certificatesIssued - before.certificatesIssued).toBe(1);
    expect(after.errors24h - before.errors24h).toBe(3);
    expect(after.emailsSent24h - before.emailsSent24h).toBe(1);
  });
});

describe("getAdminStats time series", () => {
  it("returns 30 daily and 12 weekly buckets with the current one last", () => {
    expect(after.registrationsDaily).toHaveLength(30);
    expect(after.registrationsDaily.at(-1)?.key).toBe(todayKey);
    expect(after.usersWeekly).toHaveLength(12);
    expect(after.usersWeekly.at(-1)?.key).toBe(thisWeekKey);
    expect(after.publishedEventsWeekly.at(-1)?.key).toBe(thisWeekKey);
  });

  it("buckets registrations by WIB day and excludes rows older than 30 days", () => {
    const delta = (key: string) => count(after.registrationsDaily, key) - count(before.registrationsDaily, key);
    expect(delta(yesterdayKey)).toBeGreaterThanOrEqual(1);
    expect(delta(todayKey)).toBeGreaterThanOrEqual(1);
    const total = (stats: Stats) => stats.registrationsDaily.reduce((sum, point) => sum + point.count, 0);
    expect(total(after) - total(before)).toBe(5);
  });

  it("buckets new users per ISO week at the Monday midnight WIB boundary, excluding admins", () => {
    expect(count(after.usersWeekly, thisWeekKey) - count(before.usersWeekly, thisWeekKey)).toBe(1);
    expect(count(after.usersWeekly, previousWeekKey) - count(before.usersWeekly, previousWeekKey)).toBe(1);
  });

  it("buckets published events per week by published_at", () => {
    expect(count(after.publishedEventsWeekly, thisWeekKey) - count(before.publishedEventsWeekly, thisWeekKey)).toBe(1);
    expect(count(after.publishedEventsWeekly, previousWeekKey) - count(before.publishedEventsWeekly, previousWeekKey)).toBe(1);
  });
});
