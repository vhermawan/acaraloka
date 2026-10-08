import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { defaultCertificateLayout } from "@/lib/certificate-layout";
import { disableEvent, enableEvent, listAdminEvents } from "@/server/admin-events";
import { verifyCertificate } from "@/server/certificate-verification";
import { checkIn, undoCheckIn } from "@/server/checkin";
import { getUserCertificateRenderData, issueCertificates } from "@/server/certificates";
import { createRegistration } from "@/server/registration";
import { getPublicEvent } from "@/server/public-event";

const runId = `itae-${Date.now()}`;
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 2 }) });
const organizerId = `${runId}-org`;
const adminId = `${runId}-admin`;
const userId = `${runId}-user`;
const eventIds: string[] = [];
let counter = 0;

type Status = "DRAFT" | "PUBLISHED" | "CANCELLED";

async function createEvent(status: Status, options: { started?: boolean } = {}) {
  counter += 1;
  const day = 86_400_000;
  const started = options.started ?? false;
  const event = await db.event.create({
    data: {
      organizerId,
      slug: `${runId}-${counter}`,
      title: `Admin ${runId} ${counter}`,
      description: "Admin event test",
      startAt: new Date(Date.now() + (started ? -day : day)),
      endAt: new Date(Date.now() + (started ? -day / 2 : 2 * day)),
      venue: "Test",
      status,
      publishedAt: status === "DRAFT" ? null : new Date(),
      cancelledAt: status === "CANCELLED" ? new Date() : null,
      ticketTypes: { create: { name: "Umum", quota: 10 } },
    },
    include: { ticketTypes: true },
  });
  eventIds.push(event.id);
  return { event, ticketTypeId: event.ticketTypes[0].id };
}

function registrationInput(eventId: string, ticketTypeId: string, id = userId) {
  return { eventId, ticketTypeId, userId: id, name: "Peserta", email: `${id}@test.test`, phone: "081234567890", answers: [] };
}

beforeAll(async () => {
  await db.user.createMany({
    data: [organizerId, adminId, userId].map((id) => ({ id, name: id, email: `${id}@test.test`, emailVerified: true })),
  });
  await db.organizerProfile.create({ data: { userId: organizerId, orgName: `Panitia ${runId}`, contactPhone: "081234567890" } });
});

afterAll(async () => {
  await db.auditLog.deleteMany({ where: { actorId: adminId } });
  await db.event.deleteMany({ where: { id: { in: eventIds } } });
  await db.user.deleteMany({ where: { id: { startsWith: runId } } });
  await db.$disconnect();
});

describe("disable and re-enable events against Postgres", () => {
  it.each(["DRAFT", "PUBLISHED", "CANCELLED"] as const)("restores %s after disable then enable", async (status) => {
    const { event } = await createEvent(status);

    expect(await disableEvent({ eventId: event.id, actorId: adminId, reason: "Melanggar aturan" }, db)).toEqual({
      ok: true,
      slug: event.slug,
    });
    const disabled = await db.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(disabled.status).toBe("DISABLED");
    expect(disabled.disabledReason).toBe("Melanggar aturan");

    expect(await enableEvent({ eventId: event.id, actorId: adminId }, db)).toEqual({
      ok: true,
      slug: event.slug,
      status,
    });
    const restored = await db.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(restored.status).toBe(status);
    expect(restored.disabledReason).toBeNull();

    const logs = await db.auditLog.findMany({ where: { entityId: event.id }, orderBy: { createdAt: "asc" } });
    expect(logs.map((log) => log.action)).toEqual(["event.disabled", "event.enabled"]);
    expect(logs[0].meta).toEqual({ reason: "Melanggar aturan", previousStatus: status });
    expect(logs[1].meta).toEqual({ restoredStatus: status });
  });

  it("rejects disabling twice, also in parallel, and writes one audit log", async () => {
    const { event } = await createEvent("PUBLISHED");
    const results = await Promise.all([
      disableEvent({ eventId: event.id, actorId: adminId, reason: "Pertama" }, db),
      disableEvent({ eventId: event.id, actorId: adminId, reason: "Kedua" }, db),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.find((result) => !result.ok)).toEqual({ ok: false, reason: "ALREADY_DISABLED" });
    expect(await db.auditLog.count({ where: { entityId: event.id, action: "event.disabled" } })).toBe(1);
  });

  it("rejects enabling an event that is not disabled and unknown events", async () => {
    const { event } = await createEvent("PUBLISHED");
    expect(await enableEvent({ eventId: event.id, actorId: adminId }, db)).toEqual({ ok: false, reason: "NOT_DISABLED" });
    expect(await enableEvent({ eventId: `${runId}-none`, actorId: adminId }, db)).toEqual({ ok: false, reason: "NOT_FOUND" });
    expect(await disableEvent({ eventId: `${runId}-none`, actorId: adminId, reason: "Tidak ada" }, db)).toEqual({
      ok: false,
      reason: "NOT_FOUND",
    });
  });

  it("hides the event publicly and refuses registration while disabled", async () => {
    const { event, ticketTypeId } = await createEvent("PUBLISHED");
    expect(await getPublicEvent(event.slug)).not.toBeNull();

    await disableEvent({ eventId: event.id, actorId: adminId, reason: "Melanggar aturan" }, db);
    expect(await createRegistration(registrationInput(event.id, ticketTypeId), db)).toEqual({ ok: false, reason: "CLOSED" });
    expect(await db.registration.count({ where: { eventId: event.id } })).toBe(0);

    await enableEvent({ eventId: event.id, actorId: adminId }, db);
    expect((await createRegistration(registrationInput(event.id, ticketTypeId), db)).ok).toBe(true);
  });

  it("refuses check-in and certificate issuance while disabled", async () => {
    const { event, ticketTypeId } = await createEvent("PUBLISHED");
    const registered = await createRegistration(registrationInput(event.id, ticketTypeId), db);
    if (!registered.ok) throw new Error("registration failed");

    await disableEvent({ eventId: event.id, actorId: adminId, reason: "Melanggar aturan" }, db);
    const result = await checkIn({ eventId: event.id, actorId: organizerId, target: { registrationId: registered.registrationId } }, db);
    expect(result.outcome).toBe("EVENT_CANCELLED");
    expect((await db.registration.findUniqueOrThrow({ where: { id: registered.registrationId } })).checkedInAt).toBeNull();

    await db.certificateConfig.create({
      data: {
        eventId: event.id,
        builtinKey: "default",
        pageWidth: 842,
        pageHeight: 595,
        layout: defaultCertificateLayout(1),
        lockedAt: new Date(),
      },
    });
    expect(await issueCertificates(event.id, organizerId, db)).toEqual({ ok: false, reason: "CLOSED" });
  });

  it("refuses undoing a check-in while disabled", async () => {
    const { event, ticketTypeId } = await createEvent("PUBLISHED");
    const registered = await createRegistration(registrationInput(event.id, ticketTypeId), db);
    if (!registered.ok) throw new Error("registration failed");
    const target = { registrationId: registered.registrationId };
    expect((await checkIn({ eventId: event.id, actorId: organizerId, target }, db)).outcome).toBe("VALID");

    await disableEvent({ eventId: event.id, actorId: adminId, reason: "Melanggar aturan" }, db);
    const undo = { eventId: event.id, registrationId: registered.registrationId, actorId: organizerId };
    expect(await undoCheckIn(undo, db)).toBe(false);
    expect((await db.registration.findUniqueOrThrow({ where: { id: registered.registrationId } })).checkedInAt).not.toBeNull();

    await enableEvent({ eventId: event.id, actorId: adminId }, db);
    expect(await undoCheckIn(undo, db)).toBe(true);
  });

  it("keeps issued certificates verifiable and downloadable after the event is disabled", async () => {
    const { event, ticketTypeId } = await createEvent("PUBLISHED", { started: true });
    await db.certificateConfig.create({
      data: {
        eventId: event.id,
        builtinKey: "default",
        pageWidth: 842,
        pageHeight: 595,
        layout: defaultCertificateLayout(1),
        lockedAt: new Date(),
      },
    });
    await db.signer.create({
      data: {
        eventId: event.id,
        order: 1,
        name: "Penanda",
        title: "Ketua",
        email: `${runId}-signer@test.test`,
        status: "SIGNED",
        tokenHash: `${runId}-token`,
        tokenExpiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    const registration = await db.registration.create({
      data: {
        eventId: event.id,
        ticketTypeId,
        userId,
        name: "Peserta Sertifikat",
        email: `${userId}@test.test`,
        phone: "081234567890",
        consentAt: new Date(),
        status: "CONFIRMED",
        checkedInAt: new Date(),
      },
    });
    expect(await issueCertificates(event.id, organizerId, db)).toMatchObject({ ok: true, issued: 1 });
    const certificate = await db.certificate.findUniqueOrThrow({ where: { registrationId: registration.id } });

    await disableEvent({ eventId: event.id, actorId: adminId, reason: "Melanggar aturan" }, db);

    expect((await verifyCertificate(certificate.number, db))?.status).toBe("VALID");
    expect((await getUserCertificateRenderData(userId, certificate.number, db))?.data.certificateNumber).toBe(
      certificate.number,
    );
  });
});

describe("listAdminEvents against Postgres", () => {
  it("lists active registrants, searches by title, slug and organizer, and paginates", async () => {
    const { event, ticketTypeId } = await createEvent("PUBLISHED");
    await createRegistration(registrationInput(event.id, ticketTypeId), db);
    const second = `${runId}-second`;
    await db.user.create({ data: { id: second, name: second, email: `${second}@test.test`, emailVerified: true } });
    await createRegistration(registrationInput(event.id, ticketTypeId, second), db);
    await db.registration.updateMany({
      where: { eventId: event.id, userId: second },
      data: { status: "CANCELLED" },
    });

    const byTitle = await listAdminEvents(event.title, 1, db);
    expect(byTitle.rows).toHaveLength(1);
    expect(byTitle.rows[0]).toMatchObject({
      id: event.id,
      status: "PUBLISHED",
      activeRegistrations: 1,
      organizer: { orgName: `Panitia ${runId}` },
    });

    expect((await listAdminEvents(event.slug.toUpperCase(), 1, db)).rows.map((row) => row.id)).toEqual([event.id]);
    expect((await listAdminEvents(`Panitia ${runId}`, 1, db)).total).toBe(eventIds.length);
    expect((await listAdminEvents(`${runId}-zzz`, 1, db)).rows).toEqual([]);

    const firstPage = await listAdminEvents(`Panitia ${runId}`, 1, db);
    expect(firstPage.pageCount).toBe(1);
    expect((await listAdminEvents(`Panitia ${runId}`, 99, db)).rows).toEqual([]);
  });
});
