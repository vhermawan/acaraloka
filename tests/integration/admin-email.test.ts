import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import type { OutgoingEmail, SendResult } from "@/server/resend";

process.env.EMAIL_ENABLED = "true";
process.env.RESEND_API_KEY = "re_integration_unused";
process.env.EMAIL_FROM = "Acaraloka <noreply@send.acaraloka.test>";

const { getEmailOverview, listEmailOutbox, runManualDrain } = await import("@/server/admin-email");

const runId = `iaem${Date.now()}`;
const domain = `${runId}.test`;
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 2 }) });
const adminId = `${runId}-admin`;
const SECRET = `SECRET-PAYLOAD-${runId}`;
const FUTURE = new Date("2099-01-01T00:00:00Z");
const HOUR = 3_600_000;

let counter = 0;

function row(overrides: Record<string, unknown> = {}) {
  counter += 1;
  return {
    to: `person${counter}@${domain}`,
    template: "certificate-issued",
    priority: 1,
    dedupeKey: `${runId}:${counter}`,
    payload: { name: SECRET, eventTitle: "Uji", certificatesPath: "/me/certificates" },
    ...overrides,
  };
}

function recorder(respond: (email: OutgoingEmail) => SendResult = () => ({ ok: true, id: "msg" })) {
  const calls: string[] = [];
  const send = async (email: OutgoingEmail) => {
    calls.push(email.to);
    if (!email.to.endsWith(`@${domain}`)) return { ok: false, status: 429, message: "foreign row" } as SendResult;
    return respond(email);
  };
  return { calls, send };
}

afterAll(async () => {
  await db.emailOutbox.deleteMany({ where: { dedupeKey: { startsWith: `${runId}:` } } });
  await db.auditLog.deleteMany({ where: { actorId: adminId } });
  await db.$disconnect();
});

describe("getEmailOverview", () => {
  it("counts sent, failed, queued and remaining budget from mixed rows", async () => {
    const before = await getEmailOverview({ budget: 50 }, db);
    const now = new Date();
    const hoursAgo = (hours: number) => new Date(now.getTime() - hours * HOUR);

    await db.emailOutbox.createMany({
      data: [
        row({ status: "SENT", sentAt: hoursAgo(1), payload: undefined }),
        row({ status: "SENT", sentAt: hoursAgo(23), payload: undefined }),
        row({ status: "SENT", sentAt: hoursAgo(30), payload: undefined }),
        row({ status: "FAILED", payload: undefined, updatedAt: hoursAgo(2), lastError: "422: bad" }),
        row({ status: "FAILED", payload: undefined, updatedAt: hoursAgo(40), lastError: "422: bad" }),
        row({ status: "PENDING" }),
        row({ status: "PENDING" }),
        row({ status: "SENDING", claimedAt: now }),
      ],
    });

    const after = await getEmailOverview({ budget: 50 }, db);
    expect(after.sent24h - before.sent24h).toBe(2);
    expect(after.failed24h - before.failed24h).toBe(1);
    expect(after.queued - before.queued).toBe(2);
    expect(before.remainingBudget - after.remainingBudget).toBe(3);
    expect(after.budget).toBe(50);
    expect(after.enabled).toBe(true);
  });

  it("clamps the remaining budget at zero", async () => {
    expect((await getEmailOverview({ budget: 0 }, db)).remainingBudget).toBe(0);
  });
});

describe("listEmailOutbox", () => {
  beforeAll(async () => {
    await db.emailOutbox.createMany({
      data: [
        ...Array.from({ length: 28 }, (_, index) =>
          row({
            template: "verify-email",
            status: "FAILED",
            payload: undefined,
            attempts: 5,
            createdAt: new Date(FUTURE.getTime() - index * 1000),
            to: `Budi.Santoso${index}@Gmail.com`,
            dedupeKey: `${runId}:list${index}`,
            lastError: `500: failed https://acaraloka.id/verify?token=abcdef123456 for budi${index}@gmail.com`,
          }),
        ),
        row({
          template: "reset-password",
          status: "PENDING",
          createdAt: new Date(FUTURE.getTime() + 1000),
          dedupeKey: `${runId}:listreset`,
        }),
      ],
    });
  });

  it("returns newest first without payload and with masked recipients and redacted errors", async () => {
    const result = await listEmailOutbox({ status: null, template: null }, 1, db);
    expect(result.rows).toHaveLength(25);
    expect(result.rows[0].template).toBe("reset-password");

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(SECRET);
    expect(serialized).not.toContain("person");
    expect(serialized).not.toContain("abcdef123456");
    expect(serialized.toLowerCase()).not.toContain("budi");
    for (const entry of result.rows) {
      expect(Object.keys(entry)).not.toContain("payload");
      expect(Object.keys(entry)).not.toContain("to");
      expect(Object.keys(entry)).not.toContain("lastError");
    }

    const failed = result.rows.find((entry) => entry.template === "verify-email")!;
    expect(failed.recipient).toMatch(/^bu\*\*\*@gmail\.com$/);
    expect(failed.error).toContain("[url]");
    expect(failed.error).toContain("[email]");
  });

  it("filters by status and template together", async () => {
    const failed = await listEmailOutbox({ status: "FAILED", template: "verify-email" }, 1, db);
    expect(failed.rows.every((entry) => entry.status === "FAILED" && entry.template === "verify-email")).toBe(true);
    expect(failed.total).toBeGreaterThanOrEqual(28);

    const none = await listEmailOutbox({ status: "SENT", template: "reset-password" }, 1, db);
    expect(none.rows.every((entry) => entry.status === "SENT" && entry.template === "reset-password")).toBe(true);
  });

  it("paginates without overlap", async () => {
    const filters = { status: "FAILED", template: "verify-email" } as const;
    const first = await listEmailOutbox(filters, 1, db);
    const second = await listEmailOutbox(filters, 2, db);
    expect(first.pageCount).toBeGreaterThanOrEqual(2);
    expect(second.rows.length).toBeGreaterThanOrEqual(3);
    const firstIds = new Set(first.rows.map((entry) => entry.id));
    expect(second.rows.every((entry) => !firstIds.has(entry.id))).toBe(true);
    const beyond = await listEmailOutbox(filters, 10_000, db);
    expect(beyond.rows).toEqual([]);
  });
});

describe("runManualDrain", () => {
  it("refuses when email is disabled, without touching the queue or audit log", async () => {
    const mock = recorder();
    const result = await runManualDrain({ actorId: adminId }, { db, enabled: false, send: mock.send, budget: 100_000 });
    expect(result).toEqual({ ok: false, reason: "DISABLED" });
    expect(mock.calls).toEqual([]);
    expect(await db.auditLog.count({ where: { actorId: adminId } })).toBe(0);
  });

  it("drains with the injected sender, records an audit log and then enforces the cooldown", async () => {
    await db.emailOutbox.deleteMany({
      where: { dedupeKey: { startsWith: `${runId}:` }, status: { in: ["PENDING", "SENDING"] } },
    });
    await db.emailOutbox.createMany({
      data: [
        row({ priority: -1, dedupeKey: `${runId}:drain-ok` }),
        row({ priority: -1, dedupeKey: `${runId}:drain-rejected` }),
      ],
    });
    const rejectedTo = (await db.emailOutbox.findUniqueOrThrow({ where: { dedupeKey: `${runId}:drain-rejected` } })).to;
    const mock = recorder((email) =>
      email.to === rejectedTo ? { ok: false, status: 422, message: "invalid" } : { ok: true, id: "msg" },
    );

    const result = await runManualDrain(
      { actorId: adminId },
      {
        db,
        send: mock.send,
        budget: 100_000,
        pauseMs: 0,
        baseUrl: "https://acaraloka.test",
        now: () => new Date(Date.now() + HOUR),
        report: async () => undefined,
      },
    );
    expect(result).toMatchObject({ ok: true, skipped: false, failed: 1 });
    if (!result.ok || result.skipped) throw new Error("unexpected");
    expect(result.sent).toBeGreaterThanOrEqual(1);

    const sentRow = await db.emailOutbox.findUniqueOrThrow({ where: { dedupeKey: `${runId}:drain-ok` } });
    expect(sentRow.status).toBe("SENT");
    expect(sentRow.payload).toBeNull();

    const audit = await db.auditLog.findFirstOrThrow({ where: { actorId: adminId, action: "email.drain" } });
    expect(audit.entityType).toBe("EmailOutbox");
    expect(audit.meta).toMatchObject({ skipped: false, sent: result.sent, failed: 1 });

    const second = recorder();
    const blocked = await runManualDrain(
      { actorId: adminId },
      { db, send: second.send, budget: 100_000, pauseMs: 0 },
    );
    expect(blocked).toEqual({ ok: false, reason: "COOLDOWN" });
    expect(second.calls).toEqual([]);
    expect(await db.auditLog.count({ where: { actorId: adminId } })).toBe(1);
  });
});
