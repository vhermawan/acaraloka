import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { ADMIN_ORGANIZERS_PAGE_SIZE } from "@/lib/admin-organizers";
import { listAdminEvents } from "@/server/admin-events";
import { getAdminOrganizerDetail, listAdminOrganizers } from "@/server/admin-organizers";

const runId = `itao${Date.now()}`;
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 2 }) });
const DAY = 86_400_000;
const now = Date.now();

const alfa = `${runId}-alfa`;
const bravo = `${runId}-bravo`;
const charlie = `${runId}-charlie`;
const participant = `${runId}-peserta`;
const participant2 = `${runId}-peserta2`;
const padCount = 25;
const core = `${runId}-core`;
const eventIds: string[] = [];
let counter = 0;

const coreFilters = (sort: "newest" | "name" | "events" | "registrants" | "active" = "newest") => ({ query: core, sort });

async function createEvent(organizerId: string, status: "DRAFT" | "PUBLISHED" | "CANCELLED" | "DISABLED") {
  counter += 1;
  const event = await db.event.create({
    data: {
      organizerId,
      slug: `${runId}-e${counter}`,
      title: `Acara ${runId} ${counter}`,
      description: "x",
      startAt: new Date(now + counter * DAY),
      endAt: new Date(now + counter * DAY + 3_600_000),
      venue: "Test",
      status,
      publishedAt: status === "DRAFT" ? null : new Date(),
      ticketTypes: { create: { name: "Umum", quota: 50 } },
    },
    include: { ticketTypes: true },
  });
  eventIds.push(event.id);
  return { id: event.id, ticketTypeId: event.ticketTypes[0].id };
}

async function register(
  event: { id: string; ticketTypeId: string },
  userId: string,
  status: "CONFIRMED" | "CANCELLED" = "CONFIRMED",
) {
  return db.registration.create({
    data: {
      eventId: event.id,
      ticketTypeId: event.ticketTypeId,
      userId,
      name: "Peserta",
      email: `${userId}@test.test`,
      phone: "081234567890",
      consentAt: new Date(),
      status,
    },
  });
}

async function certify(eventId: string, registrationId: string, seq: number, revoked = false) {
  await db.certificate.create({
    data: {
      eventId,
      registrationId,
      seq,
      number: `${runId}-${seq}-${registrationId}`,
      recipientName: "Peserta",
      revokedAt: revoked ? new Date() : null,
    },
  });
}

beforeAll(async () => {
  const people = [alfa, bravo, charlie, participant, participant2];
  await db.user.createMany({
    data: [
      ...people.map((id) => ({ id, name: `Akun ${id}`, email: `${id}@test.test`, emailVerified: true })),
      ...Array.from({ length: padCount }, (_, index) => ({
        id: `${runId}-pad${index}`,
        name: `Pad ${index}`,
        email: `${runId}-pad${index}@test.test`,
        emailVerified: true,
      })),
    ],
  });
  await db.organizerProfile.createMany({
    data: [
      { userId: alfa, orgName: `Alfa ${core}`, contactPhone: "0811", contactEmail: `kontak-${runId}@alfa.test`, activatedAt: new Date(now - 30 * DAY) },
      { userId: bravo, orgName: `bravo ${core}`, contactPhone: "0822", activatedAt: new Date(now - 20 * DAY) },
      { userId: charlie, orgName: `Charlie ${core}`, contactPhone: "0833", activatedAt: new Date(now - 10 * DAY) },
      ...Array.from({ length: padCount }, (_, index) => ({
        userId: `${runId}-pad${index}`,
        orgName: `Pad ${runId} ${String(index).padStart(2, "0")}`,
        contactPhone: "0899",
        activatedAt: new Date(now - 100 * DAY),
      })),
    ],
  });

  await createEvent(alfa, "DRAFT");
  const published1 = await createEvent(alfa, "PUBLISHED");
  const published2 = await createEvent(alfa, "PUBLISHED");
  const cancelled = await createEvent(alfa, "CANCELLED");
  await createEvent(alfa, "DISABLED");

  const first = await register(published1, participant);
  const second = await register(published1, participant2);
  await register(published1, charlie, "CANCELLED");
  await register(published2, participant);
  await register(cancelled, participant2);
  await certify(published1.id, first.id, 1);
  await certify(published1.id, second.id, 2, true);

  const bravoEvent = await createEvent(bravo, "PUBLISHED");
  await register(bravoEvent, participant);

  await db.$executeRaw`UPDATE events SET updated_at = ${new Date(now - 10 * DAY)} WHERE organizer_id = ${alfa}`;
  await db.$executeRaw`UPDATE events SET updated_at = ${new Date(now - 20 * DAY)} WHERE organizer_id = ${bravo}`;
  await db.session.createMany({
    data: [
      { id: `${alfa}-s`, token: `${alfa}-tok`, userId: alfa, expiresAt: new Date(now + DAY), updatedAt: new Date(now - 5 * DAY) },
      { id: `${charlie}-s`, token: `${charlie}-tok`, userId: charlie, expiresAt: new Date(now + DAY), updatedAt: new Date(now - DAY) },
    ],
  });
});

afterAll(async () => {
  await db.event.deleteMany({ where: { id: { in: eventIds } } });
  await db.registration.deleteMany({ where: { userId: { startsWith: runId } } });
  await db.user.deleteMany({ where: { id: { startsWith: runId } } });
  await db.$disconnect();
});

describe("listAdminOrganizers aggregates", () => {
  it("counts events per status, confirmed registrants, active certificates, and last activity", async () => {
    const result = await listAdminOrganizers(coreFilters("name"), 1, db);
    expect(result.total).toBe(3);
    expect(result.rows.map((row) => row.id)).toEqual([alfa, bravo, charlie]);

    const [a, b, c] = result.rows;
    expect(a).toMatchObject({
      orgName: `Alfa ${core}`,
      accountEmail: `${alfa}@test.test`,
      contactPhone: "0811",
      eventCounts: { draft: 1, published: 2, cancelled: 1, disabled: 1 },
      eventTotal: 5,
      registrantCount: 4,
      certificateCount: 1,
      disabledAt: null,
    });
    expect(a.lastActiveAt?.getTime()).toBe(now - 5 * DAY);
    expect(b).toMatchObject({ eventTotal: 1, registrantCount: 1, certificateCount: 0, contactEmail: null });
    expect(b.lastActiveAt?.getTime()).toBe(now - 20 * DAY);
    expect(c).toMatchObject({ eventTotal: 0, registrantCount: 0, certificateCount: 0 });
    expect(c.lastActiveAt?.getTime()).toBe(now - DAY);
  });

  it("reports a disabled account", async () => {
    await db.user.update({ where: { id: charlie }, data: { disabledAt: new Date() } });
    const row = (await listAdminOrganizers(coreFilters("name"), 1, db)).rows.find((entry) => entry.id === charlie);
    expect(row?.disabledAt).toBeInstanceOf(Date);
    await db.user.update({ where: { id: charlie }, data: { disabledAt: null } });
  });
});

describe("listAdminOrganizers search and sort", () => {
  it("searches case-insensitively by organization, account name, account email, and contact email", async () => {
    const ids = async (query: string) => (await listAdminOrganizers({ query, sort: "name" }, 1, db)).rows.map((row) => row.id);
    expect(await ids(`ALFA ${core}`)).toEqual([alfa]);
    expect(await ids(`Akun ${bravo}`)).toEqual([bravo]);
    expect(await ids(`${charlie}@TEST.test`)).toEqual([charlie]);
    expect(await ids(`kontak-${runId}@alfa`)).toEqual([alfa]);
    expect(await ids(`${runId}-nothing`)).toEqual([]);
  });

  it("treats wildcard characters literally", async () => {
    expect((await listAdminOrganizers({ query: "%", sort: "name" }, 1, db)).rows.filter((row) => row.id.startsWith(runId))).toEqual([]);
    expect((await listAdminOrganizers({ query: "_", sort: "name" }, 1, db)).rows.filter((row) => row.id.startsWith(runId))).toEqual([]);
  });

  it("sorts in the database before paginating", async () => {
    const order = async (sort: "newest" | "name" | "events" | "registrants" | "active") =>
      (await listAdminOrganizers(coreFilters(sort), 1, db)).rows.map((row) => row.id);
    expect(await order("newest")).toEqual([charlie, bravo, alfa]);
    expect(await order("name")).toEqual([alfa, bravo, charlie]);
    expect(await order("events")).toEqual([alfa, bravo, charlie]);
    expect(await order("registrants")).toEqual([alfa, bravo, charlie]);
    expect(await order("active")).toEqual([charlie, alfa, bravo]);
  });

  it("sorts by an aggregate across the whole set, not just the page", async () => {
    const page1 = await listAdminOrganizers({ query: runId, sort: "registrants" }, 1, db);
    expect(page1.rows.slice(0, 2).map((row) => row.id)).toEqual([alfa, bravo]);
    const page2 = await listAdminOrganizers({ query: runId, sort: "events" }, 2, db);
    expect(page2.rows.every((row) => row.eventTotal === 0)).toBe(true);
  });
});

describe("listAdminOrganizers pagination", () => {
  it("paginates with stable pages and a correct total", async () => {
    const filters = { query: runId, sort: "name" as const };
    const total = padCount + 3;
    const first = await listAdminOrganizers(filters, 1, db);
    const second = await listAdminOrganizers(filters, 2, db);
    expect(first.total).toBe(total);
    expect(first.pageCount).toBe(Math.ceil(total / ADMIN_ORGANIZERS_PAGE_SIZE));
    expect(first.rows).toHaveLength(ADMIN_ORGANIZERS_PAGE_SIZE);
    expect(second.rows).toHaveLength(total - ADMIN_ORGANIZERS_PAGE_SIZE);
    const seen = new Set([...first.rows, ...second.rows].map((row) => row.id));
    expect(seen.size).toBe(total);
    expect((await listAdminOrganizers(filters, 99, db)).rows).toEqual([]);
  });
});

describe("getAdminOrganizerDetail", () => {
  it("returns the profile aggregates and the organizer's events", async () => {
    const detail = await getAdminOrganizerDetail(alfa, db);
    expect(detail?.organizer).toMatchObject({ id: alfa, eventTotal: 5, registrantCount: 4, certificateCount: 1 });
    expect(detail?.eventTotal).toBe(5);
    expect(detail?.events).toHaveLength(5);
    expect(detail?.events.every((event) => eventIds.includes(event.id))).toBe(true);
    expect(detail?.events.reduce((sum, event) => sum + event.activeRegistrations, 0)).toBe(4);
  });

  it("returns null for unknown ids and users without an organizer profile", async () => {
    expect(await getAdminOrganizerDetail(`${runId}-none`, db)).toBeNull();
    expect(await getAdminOrganizerDetail(participant, db)).toBeNull();
  });

  it("treats a hostile id as plain data", async () => {
    expect(await getAdminOrganizerDetail("x' OR '1'='1", db)).toBeNull();
  });
});

describe("listAdminEvents organizer filter", () => {
  it("limits events to one organizer and exposes its name", async () => {
    const result = await listAdminEvents("", 1, db, alfa);
    expect(result.total).toBe(5);
    expect(result.organizer).toEqual({ id: alfa, orgName: `Alfa ${core}` });
    expect(result.rows.every((row) => row.organizer.orgName === `Alfa ${core}`)).toBe(true);
  });

  it("combines with the text query", async () => {
    const result = await listAdminEvents(`${runId} 1`, 1, db, alfa);
    expect(result.rows.every((row) => row.title.includes(`${runId} 1`))).toBe(true);
    expect((await listAdminEvents(`${runId}-nope`, 1, db, alfa)).rows).toEqual([]);
  });

  it("returns nothing for an unknown organizer and keeps old behaviour without one", async () => {
    const unknown = await listAdminEvents("", 1, db, `${runId}-ghost`);
    expect(unknown.total).toBe(0);
    expect(unknown.organizer).toEqual({ id: `${runId}-ghost`, orgName: null });
    const all = await listAdminEvents(runId, 1, db);
    expect(all.organizer).toBeNull();
    expect(all.total).toBe(eventIds.length);
  });
});
