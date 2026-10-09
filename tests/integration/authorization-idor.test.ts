import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultCertificateLayout } from "@/lib/certificate-layout";
import { generateTicketCode } from "@/lib/ticket-code";

const state = vi.hoisted(() => ({ userId: "" }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/server/email-schedule", () => ({ scheduleEmailDrain: vi.fn() }));
vi.mock("@/server/authz", async () => {
  const { prisma } = await import("@/server/db");
  return {
    canRegisterFreeTicket: () => true,
    requireUser: async () => ({ id: state.userId }),
    requireParticipant: async () => ({ id: state.userId }),
    requireOrganizer: async () => ({ user: { id: state.userId }, organizer: {} }),
    requireEventOwner: async (eventId: string) => {
      const event = await prisma.event.findUnique({ where: { id: eventId } });
      if (!event || event.organizerId !== state.userId) throw new Error("NOT_FOUND");
      return { user: { id: state.userId }, organizer: {}, event };
    },
  };
});

const { prisma: db } = await import("@/server/db");
const ticketActions = await import("@/app/organizer/events/[id]/tickets/actions");
const formActions = await import("@/app/organizer/events/[id]/form/actions");
const participantActions = await import("@/app/organizer/events/[id]/participants/actions");
const checkinActions = await import("@/app/organizer/events/[id]/checkin/actions");
const certificateActions = await import("@/app/organizer/events/[id]/certificate/actions");
const eventActions = await import("@/app/organizer/events/actions");
const myTicketActions = await import("@/app/me/tickets/[id]/actions");

const runId = `itidor-${Date.now()}`;
const attackerId = `${runId}-attacker`;
const ownerId = `${runId}-owner`;
const participantA = `${runId}-pa`;
const participantB = `${runId}-pb`;
const participantC = `${runId}-pc`;
const participantD = `${runId}-pd`;
const userIds = [attackerId, ownerId, participantA, participantB, participantC, participantD];

const ids = {
  attackerEvent: "",
  victimEvent: "",
  victimTicket: "",
  victimFields: [] as string[],
  victimRegistration: "",
  victimCheckedIn: "",
  victimTicketCode: "",
  victimSigner: "",
  victimCertificate: "",
  victimSignerTokenHash: `${runId}-token`,
};

function ticketForm(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.append(key, value);
  return data;
}

async function createEvent(organizerId: string, suffix: string) {
  return db.event.create({
    data: {
      organizerId,
      slug: `${runId}-${suffix}`,
      title: `IDOR ${suffix}`,
      description: "IDOR test",
      startAt: new Date(Date.now() - 86_400_000),
      endAt: new Date(Date.now() + 86_400_000),
      venue: "Test",
      status: "PUBLISHED",
      ticketTypes: { create: { name: "Umum", quota: 10, reservedCount: 3 } },
    },
    include: { ticketTypes: true },
  });
}

async function createRegistrationRow(
  eventId: string,
  ticketTypeId: string,
  userId: string,
  extra: { checkedInAt?: Date } = {},
) {
  return db.registration.create({
    data: {
      eventId,
      ticketTypeId,
      userId,
      name: `Peserta ${userId}`,
      email: `${userId}@test.test`,
      phone: "081234567890",
      consentAt: new Date(),
      status: "CONFIRMED",
      ticketCode: generateTicketCode(),
      ...extra,
    },
  });
}

beforeAll(async () => {
  await db.user.createMany({
    data: userIds.map((id) => ({ id, name: id, email: `${id}@test.test`, emailVerified: true })),
  });
  await db.organizerProfile.createMany({
    data: [attackerId, ownerId].map((userId) => ({ userId, orgName: "IT", contactPhone: "081234567890" })),
  });

  const attackerEvent = await createEvent(attackerId, "attacker");
  const victimEvent = await createEvent(ownerId, "victim");
  ids.attackerEvent = attackerEvent.id;
  ids.victimEvent = victimEvent.id;
  ids.victimTicket = victimEvent.ticketTypes[0].id;

  const fields = await Promise.all(
    [0, 1].map((order) =>
      db.formField.create({
        data: { eventId: victimEvent.id, label: `Pertanyaan ${order}`, type: "TEXT", order },
      }),
    ),
  );
  ids.victimFields = fields.map((field) => field.id);

  const registration = await createRegistrationRow(victimEvent.id, ids.victimTicket, participantA);
  ids.victimRegistration = registration.id;
  ids.victimTicketCode = registration.ticketCode!;

  const checkedIn = await createRegistrationRow(victimEvent.id, ids.victimTicket, participantB, {
    checkedInAt: new Date(),
  });
  ids.victimCheckedIn = checkedIn.id;

  const certified = await createRegistrationRow(victimEvent.id, ids.victimTicket, participantC, {
    checkedInAt: new Date(),
  });
  const certificate = await db.certificate.create({
    data: {
      eventId: victimEvent.id,
      registrationId: certified.id,
      seq: 1,
      number: `${runId}-CERT`,
      recipientName: certified.name,
    },
  });
  ids.victimCertificate = certificate.id;

  await db.certificateConfig.create({
    data: {
      eventId: victimEvent.id,
      builtinKey: "default",
      pageWidth: 842,
      pageHeight: 595,
      layout: defaultCertificateLayout(1),
    },
  });
  const signer = await db.signer.create({
    data: {
      eventId: victimEvent.id,
      order: 1,
      name: "Penandatangan",
      title: "Ketua",
      email: `${runId}-signer@test.test`,
      tokenHash: ids.victimSignerTokenHash,
      tokenExpiresAt: new Date(Date.now() + 86_400_000),
    },
  });
  ids.victimSigner = signer.id;
});

beforeEach(() => {
  state.userId = attackerId;
});

afterAll(async () => {
  await db.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
  await db.event.deleteMany({ where: { id: { in: [ids.attackerEvent, ids.victimEvent] } } });
  await db.user.deleteMany({ where: { id: { in: userIds } } });
});

describe("organizer actions refuse resources of another event", () => {
  it("does not touch a foreign ticket type, and does not reveal its registrations", async () => {
    const before = await db.ticketType.findUniqueOrThrow({ where: { id: ids.victimTicket } });

    const update = await ticketActions.updateTicketType(
      ids.attackerEvent,
      ids.victimTicket,
      {},
      ticketForm({ name: "Diretas", quota: "99" }),
    );
    expect(update.message).toBe("Tiket tidak ditemukan.");

    await expect(ticketActions.deleteTicketType(ids.attackerEvent, ids.victimTicket)).resolves.toEqual({});

    const after = await db.ticketType.findUniqueOrThrow({ where: { id: ids.victimTicket } });
    expect(after).toMatchObject({ name: before.name, quota: before.quota, reservedCount: before.reservedCount });
  });

  it("does not touch foreign form fields", async () => {
    await formActions.updateFormField(
      ids.attackerEvent,
      ids.victimFields[0],
      {},
      ticketForm({ label: "Diretas", type: "TEXT", options: "" }),
    );
    await formActions.moveFormField(ids.attackerEvent, ids.victimFields[0], "down");
    await formActions.deleteFormField(ids.attackerEvent, ids.victimFields[0]);

    const fields = await db.formField.findMany({ where: { eventId: ids.victimEvent }, orderBy: { order: "asc" } });
    expect(fields.map((field) => [field.id, field.label, field.order])).toEqual([
      [ids.victimFields[0], "Pertanyaan 0", 0],
      [ids.victimFields[1], "Pertanyaan 1", 1],
    ]);
  });

  it("does not cancel, check in or undo foreign registrations", async () => {
    expect(await participantActions.cancelParticipant(ids.attackerEvent, ids.victimRegistration, "")).toHaveProperty(
      "error",
    );
    expect(await checkinActions.checkInByRegistration(ids.attackerEvent, ids.victimRegistration)).toMatchObject({
      outcome: "WRONG_EVENT",
      participant: null,
    });
    expect(await checkinActions.checkInByCode(ids.attackerEvent, ids.victimTicketCode)).toMatchObject({
      outcome: "WRONG_EVENT",
      participant: null,
    });
    expect(await checkinActions.undoParticipantCheckIn(ids.attackerEvent, ids.victimCheckedIn)).toHaveProperty("error");
    expect(await checkinActions.searchParticipants(ids.attackerEvent, "Peserta")).toEqual([]);

    const victim = await db.registration.findUniqueOrThrow({ where: { id: ids.victimRegistration } });
    expect(victim).toMatchObject({ status: "CONFIRMED", checkedInAt: null });
    const checkedIn = await db.registration.findUniqueOrThrow({ where: { id: ids.victimCheckedIn } });
    expect(checkedIn.checkedInAt).not.toBeNull();
  });

  it("does not regenerate, delete or revoke foreign signers and certificates", async () => {
    expect(await certificateActions.regenerateLink(ids.attackerEvent, ids.victimSigner)).toHaveProperty("error");
    expect(await certificateActions.deleteSigner(ids.attackerEvent, ids.victimSigner)).toHaveProperty("error");
    expect(
      await certificateActions.revokeEventCertificate(ids.attackerEvent, ids.victimCertificate, "Alasan palsu"),
    ).toHaveProperty("error");

    const signer = await db.signer.findUniqueOrThrow({ where: { id: ids.victimSigner } });
    expect(signer.tokenHash).toBe(ids.victimSignerTokenHash);
    const certificate = await db.certificate.findUniqueOrThrow({ where: { id: ids.victimCertificate } });
    expect(certificate.revokedAt).toBeNull();
  });
});

describe("organizer actions refuse a non-owner of the event", () => {
  it("rejects every mutation on the victim event without changing it", async () => {
    const calls = [
      () => ticketActions.deleteTicketType(ids.victimEvent, ids.victimTicket),
      () => formActions.deleteFormField(ids.victimEvent, ids.victimFields[0]),
      () => participantActions.cancelParticipant(ids.victimEvent, ids.victimRegistration, ""),
      () => checkinActions.checkInByRegistration(ids.victimEvent, ids.victimRegistration),
      () => checkinActions.undoParticipantCheckIn(ids.victimEvent, ids.victimCheckedIn),
      () => certificateActions.deleteSigner(ids.victimEvent, ids.victimSigner),
      () => certificateActions.regenerateLink(ids.victimEvent, ids.victimSigner),
      () => certificateActions.revokeEventCertificate(ids.victimEvent, ids.victimCertificate, "Alasan palsu"),
      () => certificateActions.issueEventCertificates(ids.victimEvent),
      () => eventActions.publishEvent(ids.victimEvent),
      () => eventActions.deleteEvent(ids.victimEvent),
    ];
    for (const call of calls) await expect(call()).rejects.toThrow("NOT_FOUND");

    expect(await db.ticketType.count({ where: { id: ids.victimTicket } })).toBe(1);
    expect(await db.formField.count({ where: { eventId: ids.victimEvent } })).toBe(2);
    expect(await db.signer.count({ where: { id: ids.victimSigner } })).toBe(1);
    expect(await db.event.count({ where: { id: ids.victimEvent } })).toBe(1);
    const victim = await db.registration.findUniqueOrThrow({ where: { id: ids.victimRegistration } });
    expect(victim).toMatchObject({ status: "CONFIRMED", checkedInAt: null });
  });
});

describe("participant actions refuse registrations of another user", () => {
  it("does not cancel or rename someone else's registration", async () => {
    state.userId = participantD;

    expect(await myTicketActions.cancelMyRegistration(ids.victimRegistration)).toHaveProperty("error");
    expect(await myTicketActions.renameMyRegistration(ids.victimRegistration, "Nama Baru")).toHaveProperty("error");

    const victim = await db.registration.findUniqueOrThrow({ where: { id: ids.victimRegistration } });
    expect(victim).toMatchObject({ status: "CONFIRMED", name: `Peserta ${participantA}` });
  });

  it("lets the owner rename, proving the refusal above is about ownership", async () => {
    state.userId = participantA;
    await expect(myTicketActions.renameMyRegistration(ids.victimRegistration, "Nama Baru")).resolves.toEqual({});
    const victim = await db.registration.findUniqueOrThrow({ where: { id: ids.victimRegistration } });
    expect(victim.name).toBe("Nama Baru");
  });
});
