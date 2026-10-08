import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { CERTIFICATE_NUMBER_PREFIX } from "@/lib/brand";
import { defaultCertificateLayout } from "@/lib/certificate-layout";
import { undoCheckIn } from "@/server/checkin";
import {
  certificateIssueStats,
  getUserCertificateRenderData,
  issueCertificates,
  listUserCertificates,
  updateRegistrationName,
} from "@/server/certificates";
import { unlockCertificate, type SignatureStore } from "@/server/signers";

const runId = `itce-${Date.now()}`;
const clients = Array.from({ length: 3 }, () =>
  new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 }) }),
);
const db = clients[0];
const organizerId = `${runId}-org`;
const eventIds: string[] = [];
const ticketTypeIds: string[] = [];
let counter = 0;

const store: SignatureStore = { upload: async () => undefined, remove: async () => undefined };

type EventOptions = {
  status?: "PUBLISHED" | "CANCELLED" | "DISABLED";
  started?: boolean;
  locked?: boolean;
  signers?: ("SIGNED" | "PENDING")[];
};

async function createEvent(options: EventOptions = {}) {
  const { status = "PUBLISHED", started = true, locked = true, signers = ["SIGNED"] } = options;
  counter += 1;
  const day = 86_400_000;
  const event = await db.event.create({
    data: {
      organizerId,
      slug: `${runId}-${counter}`,
      title: `Terbit ${counter}`,
      description: "Issue test",
      startAt: new Date(Date.now() + (started ? -day : day)),
      endAt: new Date(Date.now() + (started ? -day / 2 : 2 * day)),
      venue: "Test",
      status,
      ticketTypes: { create: { name: "Umum", quota: 100 } },
    },
    include: { ticketTypes: true },
  });
  eventIds.push(event.id);
  ticketTypeIds.push(event.ticketTypes[0].id);
  await db.certificateConfig.create({
    data: {
      eventId: event.id,
      builtinKey: "default",
      pageWidth: 842,
      pageHeight: 595,
      layout: defaultCertificateLayout(signers.length),
      lockedAt: locked ? new Date() : null,
    },
  });
  for (const [index, signerStatus] of signers.entries()) {
    await db.signer.create({
      data: {
        eventId: event.id,
        order: index + 1,
        name: `S${index}`,
        title: "Ketua",
        email: `s${index}@test.test`,
        status: signerStatus,
        tokenHash: `${runId}-${counter}-${index}`,
        tokenExpiresAt: new Date(Date.now() + day),
      },
    });
  }
  return event.id;
}

async function addAttendee(eventId: string, name: string, options: { checkedIn?: boolean; cancelled?: boolean } = {}) {
  counter += 1;
  const userId = `${runId}-u${counter}`;
  await db.user.create({ data: { id: userId, name: userId, email: `${userId}@test.test`, emailVerified: true } });
  return db.registration.create({
    data: {
      eventId,
      ticketTypeId: ticketTypeIds[eventIds.indexOf(eventId)],
      userId,
      name,
      email: `${userId}@test.test`,
      phone: "081234567890",
      consentAt: new Date(),
      status: options.cancelled ? "CANCELLED" : "CONFIRMED",
      checkedInAt: options.checkedIn === false ? null : new Date(),
    },
  });
}

beforeAll(async () => {
  await db.user.create({ data: { id: organizerId, name: organizerId, email: `${organizerId}@test.test`, emailVerified: true } });
  await db.organizerProfile.create({ data: { userId: organizerId, orgName: "IT", contactPhone: "081234567890" } });
});

afterAll(async () => {
  await db.auditLog.deleteMany({ where: { actorId: organizerId } });
  await db.event.deleteMany({ where: { id: { in: eventIds } } });
  await db.user.deleteMany({ where: { id: { startsWith: runId } } });
  await Promise.all(clients.map((client) => client.$disconnect()));
});

describe("issue certificates against Postgres", () => {
  it("issues once under parallel calls without duplicates or seq collisions", async () => {
    const eventId = await createEvent();
    for (let index = 0; index < 5; index += 1) await addAttendee(eventId, `Hadir ${index}`);
    await addAttendee(eventId, "Tidak hadir", { checkedIn: false });
    await addAttendee(eventId, "Batal", { cancelled: true });

    const results = await Promise.all([
      issueCertificates(eventId, organizerId, clients[0]),
      issueCertificates(eventId, organizerId, clients[1]),
      issueCertificates(eventId, organizerId, clients[2]),
    ]);
    expect(results.every((result) => result.ok)).toBe(true);
    const counts = results.map((result) => (result.ok ? result.issued : -1)).sort((a, b) => b - a);
    expect(counts).toEqual([5, 0, 0]);

    const rows = await db.certificate.findMany({ where: { eventId }, orderBy: { seq: "asc" } });
    expect(rows.map((row) => row.seq)).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(rows.map((row) => row.registrationId)).size).toBe(5);
    expect(new Set(rows.map((row) => row.number)).size).toBe(5);
    for (const row of rows) expect(row.number).toMatch(new RegExp(`^${CERTIFICATE_NUMBER_PREFIX}-\\d{4}-\\d{4}-[A-Z0-9]{6}$`));
    expect(rows.every((row) => row.recipientName.startsWith("Hadir"))).toBe(true);

    const config = await db.certificateConfig.findUniqueOrThrow({ where: { eventId } });
    expect(config.firstIssuedAt).not.toBeNull();
    expect(await db.auditLog.count({ where: { entityId: eventId, action: "certificate.issued" } })).toBe(1);
    expect(await certificateIssueStats(eventId, db)).toEqual({ issued: 5, waiting: 0 });
  });

  it("issues a follow-up only for new attendees and continues the sequence", async () => {
    const eventId = await createEvent();
    await addAttendee(eventId, "Awal 1");
    await addAttendee(eventId, "Awal 2");
    expect(await issueCertificates(eventId, organizerId, db)).toEqual({ ok: true, issued: 2, firstIssue: true });
    const first = await db.certificateConfig.findUniqueOrThrow({ where: { eventId } });

    expect(await issueCertificates(eventId, organizerId, db)).toEqual({ ok: true, issued: 0, firstIssue: false });

    await addAttendee(eventId, "Susulan 1");
    await addAttendee(eventId, "Susulan 2");
    await addAttendee(eventId, "Susulan 3");
    expect(await certificateIssueStats(eventId, db)).toEqual({ issued: 2, waiting: 3 });
    const results = await Promise.all([
      issueCertificates(eventId, organizerId, clients[1]),
      issueCertificates(eventId, organizerId, clients[2]),
    ]);
    expect(results.map((result) => (result.ok ? result.issued : -1)).sort()).toEqual([0, 3]);

    const rows = await db.certificate.findMany({ where: { eventId }, orderBy: { seq: "asc" } });
    expect(rows.map((row) => row.seq)).toEqual([1, 2, 3, 4, 5]);
    expect(rows.slice(2).every((row) => row.recipientName.startsWith("Susulan"))).toBe(true);
    const after = await db.certificateConfig.findUniqueOrThrow({ where: { eventId } });
    expect(after.firstIssuedAt?.getTime()).toBe(first.firstIssuedAt?.getTime());
    expect(await db.auditLog.count({ where: { entityId: eventId, action: "certificate.issued_followup" } })).toBe(1);
  });

  it.each([
    ["a signer has not signed", { signers: ["SIGNED", "PENDING"] }, "NOT_SIGNED"],
    ["there are no signers", { signers: [] }, "NO_SIGNERS"],
    ["the design is not locked", { locked: false }, "NOT_LOCKED"],
    ["the event has not started", { started: false }, "NOT_STARTED"],
    ["the event is cancelled", { status: "CANCELLED" }, "CLOSED"],
    ["the event is disabled", { status: "DISABLED" }, "CLOSED"],
  ] as const)("refuses when %s", async (_label, options, reason) => {
    const eventId = await createEvent(options as EventOptions);
    await addAttendee(eventId, "Hadir");
    expect(await issueCertificates(eventId, organizerId, db)).toEqual({ ok: false, reason });
    expect(await db.certificate.count({ where: { eventId } })).toBe(0);
    expect((await db.certificateConfig.findUniqueOrThrow({ where: { eventId } })).firstIssuedAt).toBeNull();
  });

  it("refuses when the event or its config does not exist", async () => {
    expect(await issueCertificates(`${runId}-missing`, organizerId, db)).toEqual({ ok: false, reason: "NOT_FOUND" });
    const eventId = await createEvent();
    await db.certificateConfig.delete({ where: { eventId } });
    expect(await issueCertificates(eventId, organizerId, db)).toEqual({ ok: false, reason: "NOT_LOCKED" });
  });

  it("blocks unlock and undo check-in once issued", async () => {
    const eventId = await createEvent();
    const registration = await addAttendee(eventId, "Terbit");
    const waiting = await addAttendee(eventId, "Menunggu");
    await issueCertificates(eventId, organizerId, db);

    expect(await unlockCertificate({ eventId, actorId: organizerId }, db, store)).toEqual({ ok: false, reason: "ISSUED" });
    expect(await undoCheckIn({ eventId, registrationId: registration.id, actorId: organizerId }, db)).toBe(false);
    expect(await undoCheckIn({ eventId, registrationId: waiting.id, actorId: organizerId }, db)).toBe(false);
  });
});

describe("participant certificate access and name correction", () => {
  it("lets the owner rename before issue, rejects other users and rejects after issue", async () => {
    const eventId = await createEvent();
    const mine = await addAttendee(eventId, "Nama Salah");
    const other = await addAttendee(eventId, "Orang Lain");

    expect(await updateRegistrationName(other.userId!, mine.id, "Dibajak", db)).toEqual({ ok: false, reason: "NOT_EDITABLE" });
    expect(await updateRegistrationName(mine.userId!, mine.id, "Nama Benar", db)).toEqual({ ok: true });

    await issueCertificates(eventId, organizerId, db);
    const certificate = await db.certificate.findUniqueOrThrow({ where: { registrationId: mine.id } });
    expect(certificate.recipientName).toBe("Nama Benar");

    expect(await updateRegistrationName(mine.userId!, mine.id, "Terlambat", db)).toEqual({ ok: false, reason: "NOT_EDITABLE" });
    const registration = await db.registration.findUniqueOrThrow({ where: { id: mine.id } });
    expect(registration.name).toBe("Nama Benar");
  });

  it("rejects renaming a cancelled registration", async () => {
    const eventId = await createEvent();
    const cancelled = await addAttendee(eventId, "Batal", { cancelled: true });
    expect(await updateRegistrationName(cancelled.userId!, cancelled.id, "Baru", db)).toEqual({ ok: false, reason: "NOT_EDITABLE" });
  });

  it("only returns certificate data to the owner and hides revoked ones", async () => {
    const eventId = await createEvent();
    const mine = await addAttendee(eventId, "Pemilik");
    const other = await addAttendee(eventId, "Bukan Pemilik");
    await issueCertificates(eventId, organizerId, db);
    const certificate = await db.certificate.findUniqueOrThrow({ where: { registrationId: mine.id } });

    expect(await getUserCertificateRenderData(other.userId!, certificate.number, db)).toBeNull();
    const owned = await getUserCertificateRenderData(mine.userId!, certificate.number, db);
    expect(owned?.data.recipientName).toBe("Pemilik");
    expect(owned?.data.certificateNumber).toBe(certificate.number);

    expect((await listUserCertificates(other.userId!, db)).map((row) => row.number)).not.toContain(certificate.number);
    expect((await listUserCertificates(mine.userId!, db)).map((row) => row.number)).toEqual([certificate.number]);

    await db.certificate.update({ where: { id: certificate.id }, data: { revokedAt: new Date() } });
    expect(await getUserCertificateRenderData(mine.userId!, certificate.number, db)).toBeNull();
    expect((await listUserCertificates(mine.userId!, db))[0].revokedAt).not.toBeNull();
  });
});
