import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { cancelEvent, cancelRegistration } from "@/server/cancellation";
import { createRegistration } from "@/server/registration";

const runId = `itc-${Date.now()}`;
const clients = Array.from({ length: 4 }, () =>
  new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 }) }),
);
const db = clients[0];
let eventId = "";
let ticketTypeId = "";

const organizerId = `${runId}-org`;
const userIds = [0, 1, 2].map((index) => `${runId}-u${index}`);

function registrationInput(userId: string) {
  return { eventId, ticketTypeId, userId, name: userId, email: `${userId}@test.test`, phone: "081234567890", answers: [] };
}

async function reservedCount() {
  return (await db.ticketType.findUniqueOrThrow({ where: { id: ticketTypeId } })).reservedCount;
}

beforeAll(async () => {
  await db.user.createMany({
    data: [organizerId, ...userIds].map((id) => ({ id, name: id, email: `${id}@test.test`, emailVerified: true })),
  });
  await db.organizerProfile.create({ data: { userId: organizerId, orgName: "IT", contactPhone: "081234567890" } });
  const event = await db.event.create({
    data: {
      organizerId,
      slug: runId,
      title: "Cancellation test",
      description: "Cancellation test",
      startAt: new Date(Date.now() + 86_400_000),
      endAt: new Date(Date.now() + 90_000_000),
      venue: "Test",
      status: "PUBLISHED",
      ticketTypes: { create: { name: "Umum", quota: 2 } },
    },
    include: { ticketTypes: true },
  });
  eventId = event.id;
  ticketTypeId = event.ticketTypes[0].id;
});

afterAll(async () => {
  await db.registration.deleteMany({ where: { eventId } });
  await db.event.deleteMany({ where: { id: eventId } });
  await db.user.deleteMany({ where: { id: { startsWith: runId } } });
  await Promise.all(clients.map((client) => client.$disconnect()));
});

describe("cancellation against Postgres", () => {
  it("returns the seat exactly once, even with parallel cancel requests", async () => {
    const first = await createRegistration(registrationInput(userIds[0]), db);
    const second = await createRegistration(registrationInput(userIds[1]), db);
    expect(first.ok && second.ok).toBe(true);
    expect(await reservedCount()).toBe(2);
    expect(await createRegistration(registrationInput(userIds[2]), db)).toEqual({ ok: false, reason: "SOLD_OUT" });

    const registrationId = first.ok ? first.registrationId : "";
    const results = await Promise.all(
      clients.map((client) =>
        cancelRegistration({ registrationId, eventId, actorId: userIds[0], reason: "test" }, client),
      ),
    );
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(await reservedCount()).toBe(1);

    expect((await createRegistration(registrationInput(userIds[2]), db)).ok).toBe(true);
    expect(await reservedCount()).toBe(2);
  });

  it("lets a cancelled participant register again", async () => {
    await db.ticketType.update({ where: { id: ticketTypeId }, data: { quota: 3 } });
    expect((await createRegistration(registrationInput(userIds[0]), db)).ok).toBe(true);
    expect(await reservedCount()).toBe(3);
  });

  it("does not cancel checked-in registrations", async () => {
    const registration = await db.registration.findFirstOrThrow({ where: { eventId, userId: userIds[1], status: "CONFIRMED" } });
    await db.registration.update({ where: { id: registration.id }, data: { checkedInAt: new Date() } });
    await expect(
      cancelRegistration({ registrationId: registration.id, eventId, actorId: organizerId, reason: null }, db),
    ).resolves.toEqual({ ok: false, reason: "NOT_CANCELLABLE" });
    expect(await reservedCount()).toBe(3);
  });

  it("refuses cancellation through another event id", async () => {
    const registration = await db.registration.findFirstOrThrow({ where: { eventId, userId: userIds[2], status: "CONFIRMED" } });
    await expect(
      cancelRegistration({ registrationId: registration.id, eventId: "other-event", actorId: organizerId, reason: null }, db),
    ).resolves.toEqual({ ok: false, reason: "NOT_CANCELLABLE" });
  });

  it("cancels the event only before it starts", async () => {
    const afterStart = new Date(Date.now() + 87_000_000);
    expect(await cancelEvent({ eventId, reason: "Terlambat" }, db, afterStart)).toBe(false);
    expect(await cancelEvent({ eventId, reason: "Pembicara berhalangan" }, db)).toBe(true);
    expect(await cancelEvent({ eventId, reason: "Lagi" }, db)).toBe(false);
    await expect(createRegistration(registrationInput(`${runId}-org`), db)).resolves.toEqual({ ok: false, reason: "CLOSED" });
  });
});
