import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { createRegistration } from "@/server/registration";

const PARALLEL = 8;
const runId = `it-${Date.now()}`;

function createClient() {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 }) });
}

const clients = Array.from({ length: PARALLEL }, createClient);
const db = clients[0];
let eventId = "";
let ticketTypeId = "";

function input(userIndex: number) {
  return {
    eventId,
    ticketTypeId,
    userId: `${runId}-u${userIndex}`,
    name: `Peserta ${userIndex}`,
    email: `p${userIndex}@${runId}.test`,
    phone: "081234567890",
    answers: [],
  };
}

beforeAll(async () => {
  await db.user.createMany({
    data: Array.from({ length: PARALLEL + 1 }, (_, index) => ({
      id: `${runId}-u${index}`,
      name: `Peserta ${index}`,
      email: `p${index}@${runId}.test`,
      emailVerified: true,
    })),
  });
  await db.organizerProfile.create({
    data: { userId: `${runId}-u${PARALLEL}`, orgName: "Integration", contactPhone: "081234567890" },
  });
  const event = await db.event.create({
    data: {
      organizerId: `${runId}-u${PARALLEL}`,
      slug: runId,
      title: "Integration test",
      description: "Integration test event",
      startAt: new Date(Date.now() + 86_400_000),
      endAt: new Date(Date.now() + 90_000_000),
      venue: "Test",
      status: "PUBLISHED",
      ticketTypes: { create: { name: "Umum", quota: 1 } },
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

describe("createRegistration against Postgres", () => {
  it("lets exactly one of N parallel requests take the last seat", async () => {
    const results = await Promise.all(clients.map((client, index) => createRegistration(input(index), client)));

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok && result.reason === "SOLD_OUT")).toHaveLength(PARALLEL - 1);

    const ticket = await db.ticketType.findUniqueOrThrow({ where: { id: ticketTypeId } });
    expect(ticket.reservedCount).toBe(1);
    expect(await db.registration.count({ where: { eventId } })).toBe(1);
  });

  it("rejects a second registration by the same user even when sent in parallel", async () => {
    await db.ticketType.update({ where: { id: ticketTypeId }, data: { quota: 10 } });
    const winner = await db.registration.findFirstOrThrow({ where: { eventId } });
    const index = Number(winner.userId.split("-u").pop());

    const results = await Promise.all(clients.slice(0, 3).map((client) => createRegistration(input(index), client)));
    expect(results.every((result) => !result.ok && result.reason === "ALREADY_REGISTERED")).toBe(true);

    const fresh = (index + 1) % PARALLEL;
    const duplicates = await Promise.all(clients.slice(0, 4).map((client) => createRegistration(input(fresh), client)));
    expect(duplicates.filter((result) => result.ok)).toHaveLength(1);
    expect(duplicates.filter((result) => !result.ok && result.reason === "ALREADY_REGISTERED")).toHaveLength(3);

    const ticket = await db.ticketType.findUniqueOrThrow({ where: { id: ticketTypeId } });
    expect(ticket.reservedCount).toBe(2);
  });

  it("refuses registration for non-published events", async () => {
    await db.event.update({ where: { id: eventId }, data: { status: "CANCELLED" } });
    await expect(createRegistration(input(PARALLEL), db)).resolves.toEqual({ ok: false, reason: "CLOSED" });
    await db.event.update({ where: { id: eventId }, data: { status: "PUBLISHED" } });
  });

  it.each(["ORGANIZER", "ADMIN"] as const)("refuses registration for %s accounts without reserving a seat", async (role) => {
    const before = await db.ticketType.findUniqueOrThrow({ where: { id: ticketTypeId } });
    await db.user.update({ where: { id: `${runId}-u${PARALLEL}` }, data: { role } });
    await expect(createRegistration(input(PARALLEL), db)).resolves.toEqual({
      ok: false,
      reason: "NON_PARTICIPANT_ACCOUNT",
    });
    const after = await db.ticketType.findUniqueOrThrow({ where: { id: ticketTypeId } });
    expect(after.reservedCount).toBe(before.reservedCount);
    await db.user.update({ where: { id: `${runId}-u${PARALLEL}` }, data: { role: "PARTICIPANT" } });
  });
});
