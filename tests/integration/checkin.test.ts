import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { cancelRegistration } from "@/server/cancellation";
import { checkIn, searchCheckInParticipants, undoCheckIn } from "@/server/checkin";
import { createRegistration } from "@/server/registration";

const runId = `itk-${Date.now()}`;
const clients = Array.from({ length: 4 }, () =>
  new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 }) }),
);
const db = clients[0];
const organizerId = `${runId}-org`;
const userIds = [0, 1, 2].map((index) => `${runId}-u${index}`);
const eventIds: string[] = [];
const ticketTypeIds: string[] = [];

async function createEvent(suffix: string) {
  const event = await db.event.create({
    data: {
      organizerId,
      slug: `${runId}-${suffix}`,
      title: `Check-in ${suffix}`,
      description: "Check-in test",
      startAt: new Date(Date.now() + 86_400_000),
      endAt: new Date(Date.now() + 90_000_000),
      venue: "Test",
      status: "PUBLISHED",
      ticketTypes: { create: { name: "Umum", quota: 10 } },
    },
    include: { ticketTypes: true },
  });
  eventIds.push(event.id);
  ticketTypeIds.push(event.ticketTypes[0].id);
}

async function register(eventIndex: number, userId: string) {
  const result = await createRegistration(
    {
      eventId: eventIds[eventIndex],
      ticketTypeId: ticketTypeIds[eventIndex],
      userId,
      name: `Peserta ${userId}`,
      email: `${userId}@test.test`,
      phone: "081234567890",
      answers: [],
    },
    db,
  );
  if (!result.ok) throw new Error(result.reason);
  return db.registration.findUniqueOrThrow({ where: { id: result.registrationId } });
}

beforeAll(async () => {
  await db.user.createMany({
    data: [organizerId, ...userIds].map((id) => ({ id, name: id, email: `${id}@test.test`, emailVerified: true })),
  });
  await db.organizerProfile.create({ data: { userId: organizerId, orgName: "IT", contactPhone: "081234567890" } });
  await createEvent("a");
  await createEvent("b");
});

afterAll(async () => {
  await db.auditLog.deleteMany({ where: { actorId: organizerId } });
  await db.registration.deleteMany({ where: { eventId: { in: eventIds } } });
  await db.event.deleteMany({ where: { id: { in: eventIds } } });
  await db.user.deleteMany({ where: { id: { startsWith: runId } } });
  await Promise.all(clients.map((client) => client.$disconnect()));
});

describe("check-in against Postgres", () => {
  it("accepts a ticket exactly once under parallel scans", async () => {
    const registration = await register(0, userIds[0]);
    const results = await Promise.all(
      clients.map((client) =>
        checkIn({ eventId: eventIds[0], actorId: organizerId, target: { ticketCode: registration.ticketCode! } }, client),
      ),
    );

    expect(results.filter((result) => result.outcome === "VALID")).toHaveLength(1);
    expect(results.filter((result) => result.outcome === "ALREADY_CHECKED_IN")).toHaveLength(3);
    const valid = results.find((result) => result.outcome === "VALID");
    expect(valid?.participant).toMatchObject({ name: `Peserta ${userIds[0]}`, ticketTypeName: "Umum" });

    const stored = await db.registration.findUniqueOrThrow({ where: { id: registration.id } });
    expect(stored.checkedInAt).not.toBeNull();
    expect(stored.checkedInById).toBe(organizerId);
  });

  it("explains why a ticket is rejected", async () => {
    const otherEvent = await register(1, userIds[1]);
    await expect(
      checkIn({ eventId: eventIds[0], actorId: organizerId, target: { ticketCode: otherEvent.ticketCode! } }, db),
    ).resolves.toEqual({ outcome: "WRONG_EVENT", participant: null });

    await expect(
      checkIn({ eventId: eventIds[0], actorId: organizerId, target: { ticketCode: "a".repeat(26) } }, db),
    ).resolves.toEqual({ outcome: "INVALID", participant: null });

    const cancelled = await register(0, userIds[1]);
    await cancelRegistration({ registrationId: cancelled.id, eventId: eventIds[0], actorId: organizerId, reason: null }, db);
    const cancelledResult = await checkIn(
      { eventId: eventIds[0], actorId: organizerId, target: { ticketCode: cancelled.ticketCode! } },
      db,
    );
    expect(cancelledResult.outcome).toBe("CANCELLED");
  });

  it("checks in by registration id from name search", async () => {
    await register(0, userIds[2]);
    const rows = await searchCheckInParticipants(eventIds[0], userIds[2].slice(-6), db);
    expect(rows).toHaveLength(1);
    expect(rows[0].checkedInAt).toBeNull();

    const result = await checkIn(
      { eventId: eventIds[0], actorId: organizerId, target: { registrationId: rows[0].registrationId } },
      db,
    );
    expect(result.outcome).toBe("VALID");

    await expect(
      checkIn({ eventId: eventIds[1], actorId: organizerId, target: { registrationId: rows[0].registrationId } }, db),
    ).resolves.toEqual({ outcome: "WRONG_EVENT", participant: null });
  });

  it("undoes a check-in once and writes an audit log", async () => {
    const registration = await db.registration.findFirstOrThrow({
      where: { eventId: eventIds[0], userId: userIds[0], status: "CONFIRMED" },
    });
    const undo = await Promise.all(
      clients.map((client) =>
        undoCheckIn({ eventId: eventIds[0], registrationId: registration.id, actorId: organizerId }, client),
      ),
    );
    expect(undo.filter(Boolean)).toHaveLength(1);

    const stored = await db.registration.findUniqueOrThrow({ where: { id: registration.id } });
    expect(stored.checkedInAt).toBeNull();
    const logs = await db.auditLog.findMany({ where: { entityId: registration.id, action: "checkin.undo" } });
    expect(logs).toHaveLength(1);

    const again = await checkIn(
      { eventId: eventIds[0], actorId: organizerId, target: { ticketCode: registration.ticketCode! } },
      db,
    );
    expect(again.outcome).toBe("VALID");
  });

  it("refuses undo through another event id", async () => {
    const registration = await db.registration.findFirstOrThrow({
      where: { eventId: eventIds[0], userId: userIds[0], status: "CONFIRMED" },
    });
    await expect(
      undoCheckIn({ eventId: eventIds[1], registrationId: registration.id, actorId: organizerId }, db),
    ).resolves.toBe(false);
  });

  it("rejects every scan once the event is cancelled", async () => {
    const registration = await db.registration.findFirstOrThrow({
      where: { eventId: eventIds[1], userId: userIds[1] },
    });
    await db.event.update({ where: { id: eventIds[1] }, data: { status: "CANCELLED" } });
    await expect(
      checkIn({ eventId: eventIds[1], actorId: organizerId, target: { ticketCode: registration.ticketCode! } }, db),
    ).resolves.toEqual({ outcome: "EVENT_CANCELLED", participant: null });
    const stored = await db.registration.findUniqueOrThrow({ where: { id: registration.id } });
    expect(stored.checkedInAt).toBeNull();
  });
});
