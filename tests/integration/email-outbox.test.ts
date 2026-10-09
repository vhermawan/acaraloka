import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import type { OutboxItem } from "@/lib/email-outbox";
import type { OutgoingEmail, SendResult } from "@/server/resend";

process.env.EMAIL_ENABLED = "true";
process.env.RESEND_API_KEY = "re_integration_unused";
process.env.EMAIL_FROM = "Acaraloka <noreply@send.acaraloka.test>";

const { drainOutbox, enqueueEmails } = await import("@/server/email-outbox");
const { createRegistration } = await import("@/server/registration");
const { cancelEvent } = await import("@/server/cancellation");
const { addSigner, regenerateSignerLink } = await import("@/server/signers");

const runId = `item-${Date.now()}`;
const domain = `${runId}.test`;
const clients = Array.from({ length: 3 }, () =>
  new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 }) }),
);
const db = clients[0];
const organizerId = `${runId}-org`;
let eventId = "";
let ticketTypeId = "";

function item(key: string, priority = 1): OutboxItem {
  return {
    to: `${key}@${domain}`,
    dedupeKey: `${runId}:${key}`,
    priority,
    template: "certificate-issued",
    payload: { name: key, eventTitle: "Uji", certificatesPath: "/me/certificates" },
  };
}

function recorder(respond: (email: OutgoingEmail, call: number) => SendResult = () => ({ ok: true, id: "msg" })) {
  const calls: { to: string; key: string }[] = [];
  const send = async (email: OutgoingEmail, key: string) => {
    calls.push({ to: email.to, key });
    return respond(email, calls.length);
  };
  return { calls, send };
}

async function usedBudget() {
  return db.emailOutbox.count({
    where: { OR: [{ sentAt: { gt: new Date(Date.now() - 86_400_000) } }, { status: "SENDING" }] },
  });
}

async function rowsFor(keys: string[]) {
  return db.emailOutbox.findMany({ where: { dedupeKey: { in: keys.map((key) => `${runId}:${key}`) } } });
}

const drain = (options: Parameters<typeof drainOutbox>[0]) =>
  drainOutbox({ db, pauseMs: 0, baseUrl: "https://acaraloka.test", report: async () => undefined, ...options });

beforeAll(async () => {
  await db.emailOutbox.deleteMany({ where: { status: { in: ["PENDING", "SENDING"] }, to: { endsWith: ".test" } } });
  await db.user.createMany({
    data: [organizerId, `${runId}-u1`].map((id) => ({ id, name: id, email: `${id}@${domain}`, emailVerified: true })),
  });
  await db.organizerProfile.create({ data: { userId: organizerId, orgName: "HIMA Uji", contactPhone: "081234567890" } });
  const event = await db.event.create({
    data: {
      organizerId,
      slug: runId,
      title: "Email test",
      description: "Email test",
      startAt: new Date(Date.now() + 86_400_000),
      endAt: new Date(Date.now() + 90_000_000),
      venue: "Aula Uji",
      status: "PUBLISHED",
      ticketTypes: { create: { name: "Umum", quota: 5 } },
    },
    include: { ticketTypes: true },
  });
  eventId = event.id;
  ticketTypeId = event.ticketTypes[0].id;
});

afterAll(async () => {
  await db.emailOutbox.deleteMany({ where: { to: { endsWith: `@${domain}` } } });
  await db.auditLog.deleteMany({ where: { actorId: organizerId } });
  await db.registration.deleteMany({ where: { eventId } });
  await db.event.deleteMany({ where: { id: eventId } });
  await db.user.deleteMany({ where: { id: { startsWith: runId } } });
  await Promise.all(clients.map((client) => client.$disconnect()));
});

describe("email outbox against Postgres", () => {
  it("ignores duplicate dedupe keys", async () => {
    expect(await enqueueEmails(db, [item("dup"), item("dup")])).toBe(1);
    expect(await enqueueEmails(db, [item("dup")])).toBe(0);
    expect(await enqueueEmails(db, [item("off")], false)).toBe(0);
    expect(await rowsFor(["dup", "off"])).toHaveLength(1);
  });

  it("sends by priority, records the provider id and clears the payload", async () => {
    await enqueueEmails(db, [item("bulk", 2), item("urgent", 1)]);
    const { calls, send } = recorder();

    const result = await drain({ send, budget: 95 });

    expect(result).toMatchObject({ skipped: false, sent: 3, failed: 0 });
    expect(calls.map((call) => call.key)).toEqual([`${runId}:dup`, `${runId}:urgent`, `${runId}:bulk`]);
    const rows = await rowsFor(["dup", "urgent", "bulk"]);
    expect(rows.every((row) => row.status === "SENT" && row.payload === null && row.providerMessageId === "msg")).toBe(true);

    const again = recorder();
    await drain({ send: again.send, budget: 95 });
    expect(again.calls).toHaveLength(0);
  });

  it("stops at the daily budget and leaves the rest pending", async () => {
    await enqueueEmails(db, [item("b1"), item("b2"), item("b3")]);
    const { calls, send } = recorder();

    await drain({ send, budget: (await usedBudget()) + 1 });

    expect(calls).toHaveLength(1);
    const rows = await rowsFor(["b1", "b2", "b3"]);
    expect(rows.filter((row) => row.status === "SENT")).toHaveLength(1);
    expect(rows.filter((row) => row.status === "PENDING")).toHaveLength(2);
  });

  it("retries transient errors, gives up on rejections and releases rows on rate limits", async () => {
    await db.emailOutbox.updateMany({ where: { dedupeKey: { in: [`${runId}:b2`, `${runId}:b3`] } }, data: { status: "FAILED" } });
    await enqueueEmails(db, [item("t500"), item("t422"), item("t429a", 2), item("t429b", 2)]);
    const { send } = recorder((email) => {
      if (email.to.startsWith("t500")) return { ok: false, status: 500, message: "boom" };
      if (email.to.startsWith("t422")) return { ok: false, status: 422, message: `Invalid to ${email.to}` };
      return { ok: false, status: 429, message: "slow down" };
    });

    const result = await drain({ send, budget: 95 });

    expect(result).toMatchObject({ retrying: 1, failed: 1, rateLimited: true });
    const rows = Object.fromEntries((await rowsFor(["t500", "t422", "t429a", "t429b"])).map((row) => [row.to.split("@")[0], row]));
    expect(rows.t500).toMatchObject({ status: "PENDING", attempts: 1 });
    expect(rows.t500.sendAfter.getTime()).toBeGreaterThan(Date.now());
    expect(rows.t422).toMatchObject({ status: "FAILED", attempts: 1, payload: null });
    expect(rows.t422.lastError).toContain("[email]");
    expect(rows.t422.lastError).not.toContain(domain);
    expect(rows.t429a).toMatchObject({ status: "PENDING", attempts: 0, claimedAt: null });
    expect(rows.t429b).toMatchObject({ status: "PENDING", attempts: 0, claimedAt: null });
  });

  it("never sends the same row twice when drains run in parallel", async () => {
    await db.emailOutbox.updateMany({ where: { to: { endsWith: `@${domain}` }, status: "PENDING" }, data: { status: "FAILED" } });
    await enqueueEmails(db, ["p1", "p2", "p3", "p4"].map((key) => item(key)));
    const { calls, send } = recorder();

    await Promise.all(clients.map((client) => drainOutbox({ db: client, send, budget: 95, pauseMs: 0, report: async () => undefined })));

    expect(calls.map((call) => call.key).sort()).toEqual(["p1", "p2", "p3", "p4"].map((key) => `${runId}:${key}`));
  });

  it("queues e-ticket, signer invite and cancellation emails from domain actions", async () => {
    const registration = await createRegistration(
      { eventId, ticketTypeId, userId: `${runId}-u1`, name: "Peserta Uji", email: `peserta@${domain}`, phone: "081234567890", answers: [] },
      db,
    );
    expect(registration.ok).toBe(true);
    const registrationId = registration.ok ? registration.registrationId : "";

    const added = await addSigner({ eventId, name: "Dr. Uji", title: "Ketua", email: `signer@${domain}` }, db);
    expect(added).toMatchObject({ ok: true, emailed: true });
    const signerRow = await db.signer.findFirstOrThrow({ where: { eventId } });
    await regenerateSignerLink({ eventId, signerId: signerRow.id, actorId: organizerId, sendEmail: true }, db);
    await regenerateSignerLink({ eventId, signerId: signerRow.id, actorId: organizerId }, db);

    expect(await cancelEvent({ eventId, reason: "Pembicara berhalangan" }, db)).toBe(true);

    const rows = await db.emailOutbox.findMany({
      where: { to: { in: [`peserta@${domain}`, `signer@${domain}`] } },
      orderBy: { createdAt: "asc" },
    });
    expect(rows.map((row) => [row.template, row.to.split("@")[0]])).toEqual([
      ["ticket-confirmed", "peserta"],
      ["signer-invite", "signer"],
      ["signer-invite", "signer"],
      ["event-cancelled", "peserta"],
    ]);
    expect(rows[0].dedupeKey).toBe(`ticket-confirmed:${registrationId}`);
    expect(rows[1].payload).toMatchObject({ signPath: `/sign/${added.ok ? added.token : ""}`, organizerName: "HIMA Uji" });
    expect(rows[3].payload).toMatchObject({ reason: "Pembicara berhalangan", ticketPath: `/me/tickets/${registrationId}` });
  });
});
