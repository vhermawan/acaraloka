import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { disableUser, enableUser, getAdminUserDetail, listAdminUsers } from "@/server/admin-users";

process.env.EMAIL_ENABLED = "true";
process.env.RESEND_API_KEY = "re_integration_unused";
process.env.EMAIL_FROM = "Acaraloka <noreply@send.acaraloka.test>";

vi.mock("@/server/email-schedule", () => ({ scheduleEmailDrain: vi.fn() }));

const { auth } = await import("@/lib/auth");

const runId = `itau${Date.now()}`;
const ORIGIN = "http://localhost:3000";
const PASSWORD = "kata-sandi-aman-1";
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 2 }) });
const adminId = `${runId}-admin`;
const otherAdminId = `${runId}-admin2`;
const participantId = `${runId}-peserta`;
const organizerId = `${runId}-panitia`;
const eventIds: string[] = [];
let sessionCounter = 0;

async function addSessions(userId: string, count: number) {
  await db.session.createMany({
    data: Array.from({ length: count }, () => ({
      id: `${userId}-s${(sessionCounter += 1)}`,
      token: `${userId}-tok${sessionCounter}`,
      userId,
      expiresAt: new Date(Date.now() + 86_400_000),
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0",
      ipAddress: "203.0.113.7",
    })),
  });
}

async function signInRequest(email: string) {
  const response = await auth.handler(
    new Request(`${ORIGIN}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body: JSON.stringify({ email, password: PASSWORD }),
    }),
  );
  const json = (await response.json().catch(() => null)) as { code?: string } | null;
  return { status: response.status, code: json?.code, cookie: response.headers.get("set-cookie") };
}

beforeAll(async () => {
  await db.user.createMany({
    data: [
      { id: adminId, name: `Admin ${runId}`, email: `${adminId}@test.test`, emailVerified: true, role: "ADMIN" },
      { id: otherAdminId, name: `Admin Dua ${runId}`, email: `${otherAdminId}@test.test`, emailVerified: true, role: "ADMIN" },
      { id: participantId, name: `Peserta ${runId}`, email: `${participantId}@test.test`, emailVerified: true },
      { id: organizerId, name: `Panitia ${runId}`, email: `${organizerId}@test.test`, emailVerified: false, role: "ORGANIZER" },
    ],
  });
  await db.account.create({ data: { id: `${participantId}-acc`, accountId: participantId, providerId: "google", userId: participantId } });
  await db.organizerProfile.create({ data: { userId: organizerId, orgName: `Org ${runId}`, contactPhone: "081234567890" } });
  const event = await db.event.create({
    data: {
      organizerId,
      slug: `${runId}-event`,
      title: `Acara ${runId}`,
      description: "x",
      startAt: new Date(Date.now() + 86_400_000),
      endAt: new Date(Date.now() + 2 * 86_400_000),
      venue: "Test",
      status: "PUBLISHED",
      publishedAt: new Date(),
      ticketTypes: { create: { name: "Umum", quota: 5 } },
    },
    include: { ticketTypes: true },
  });
  eventIds.push(event.id);
  await db.registration.create({
    data: {
      eventId: event.id,
      ticketTypeId: event.ticketTypes[0].id,
      userId: participantId,
      name: "Peserta",
      email: `${participantId}@test.test`,
      phone: "081234567890",
      consentAt: new Date(),
    },
  });
});

afterAll(async () => {
  await db.auditLog.deleteMany({ where: { entityType: "User", entityId: { startsWith: runId } } });
  await db.event.deleteMany({ where: { id: { in: eventIds } } });
  await db.registration.deleteMany({ where: { userId: { startsWith: runId } } });
  await db.user.deleteMany({ where: { OR: [{ id: { startsWith: runId } }, { email: { endsWith: `@${runId}.test` } }] } });
  await db.$disconnect();
});

describe("disable and re-enable users against Postgres", () => {
  it("sets disabledAt, deletes every session, and writes one audit log", async () => {
    await addSessions(participantId, 3);
    await addSessions(organizerId, 1);

    const result = await disableUser({ userId: participantId, actorId: adminId, reason: "Penyalahgunaan" }, db);
    expect(result).toEqual({ ok: true, revokedSessions: 3 });

    const user = await db.user.findUniqueOrThrow({ where: { id: participantId } });
    expect(user.disabledAt).toBeInstanceOf(Date);
    expect(await db.session.count({ where: { userId: participantId } })).toBe(0);
    expect(await db.session.count({ where: { userId: organizerId } })).toBe(1);

    const logs = await db.auditLog.findMany({ where: { entityType: "User", entityId: participantId } });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      actorId: adminId,
      action: "user.disabled",
      meta: { reason: "Penyalahgunaan", role: "PARTICIPANT", revokedSessions: 3 },
    });
  });

  it("refuses to disable twice", async () => {
    expect(await disableUser({ userId: participantId, actorId: adminId, reason: "Lagi" }, db)).toEqual({
      ok: false,
      reason: "ALREADY_DISABLED",
    });
    expect(await db.auditLog.count({ where: { entityType: "User", entityId: participantId } })).toBe(1);
  });

  it("re-enables and logs it", async () => {
    expect(await enableUser({ userId: participantId, actorId: adminId }, db)).toEqual({ ok: true });
    expect((await db.user.findUniqueOrThrow({ where: { id: participantId } })).disabledAt).toBeNull();
    const actions = (await db.auditLog.findMany({ where: { entityType: "User", entityId: participantId }, orderBy: { createdAt: "asc" } })).map(
      (log) => log.action,
    );
    expect(actions).toEqual(["user.disabled", "user.enabled"]);
    expect(await enableUser({ userId: participantId, actorId: adminId }, db)).toEqual({ ok: false, reason: "NOT_DISABLED" });
  });

  it("cannot disable yourself or another admin, and changes nothing", async () => {
    await addSessions(otherAdminId, 1);
    expect(await disableUser({ userId: adminId, actorId: adminId, reason: "Uji diri" }, db)).toEqual({ ok: false, reason: "SELF" });
    expect(await disableUser({ userId: otherAdminId, actorId: adminId, reason: "Uji admin" }, db)).toEqual({
      ok: false,
      reason: "ADMIN_TARGET",
    });
    for (const id of [adminId, otherAdminId]) {
      expect((await db.user.findUniqueOrThrow({ where: { id } })).disabledAt).toBeNull();
      expect(await db.auditLog.count({ where: { entityType: "User", entityId: id } })).toBe(0);
    }
    expect(await db.session.count({ where: { userId: otherAdminId } })).toBe(1);
  });

  it("reports unknown users", async () => {
    expect(await disableUser({ userId: `${runId}-none`, actorId: adminId, reason: "Tidak ada" }, db)).toEqual({
      ok: false,
      reason: "NOT_FOUND",
    });
    expect(await enableUser({ userId: `${runId}-none`, actorId: adminId }, db)).toEqual({ ok: false, reason: "NOT_FOUND" });
  });

  it("rolls everything back when the audit log cannot be written", async () => {
    await addSessions(participantId, 1);
    const failing = new Proxy(db, {
      get(target, property, receiver) {
        if (property !== "$transaction") return Reflect.get(target, property, receiver);
        return (fn: (tx: unknown) => Promise<unknown>) =>
          target.$transaction((tx) =>
            fn({
              user: tx.user,
              session: tx.session,
              auditLog: {
                create: () => {
                  throw new Error("audit failed");
                },
              },
            }),
          );
      },
    }) as PrismaClient;

    await expect(disableUser({ userId: participantId, actorId: adminId, reason: "Gagal catat" }, failing)).rejects.toThrow("audit failed");
    expect((await db.user.findUniqueOrThrow({ where: { id: participantId } })).disabledAt).toBeNull();
    expect(await db.session.count({ where: { userId: participantId } })).toBe(1);
    await db.session.deleteMany({ where: { userId: participantId } });
  });
});

describe("password sign-in for disabled users", () => {
  it("refuses a new session once disabled, and works again after re-enabling", async () => {
    const email = `masuk@${runId}.test`;
    const signUp = await auth.handler(
      new Request(`${ORIGIN}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: ORIGIN },
        body: JSON.stringify({ name: "Budi Uji", email, password: PASSWORD, intent: "PARTICIPANT", acceptTerms: true }),
      }),
    );
    expect(signUp.status).toBe(200);
    const created = await db.user.update({ where: { email }, data: { emailVerified: true } });

    const ok = await signInRequest(email);
    expect(ok.status).toBe(200);
    expect(ok.cookie).toContain("session_token");
    expect(await db.session.count({ where: { userId: created.id } })).toBe(1);

    expect(await disableUser({ userId: created.id, actorId: adminId, reason: "Uji masuk ulang" }, db)).toEqual({
      ok: true,
      revokedSessions: 1,
    });

    const blocked = await signInRequest(email);
    expect(blocked.status).toBe(403);
    expect(blocked.code).toBe("ACCOUNT_DISABLED");
    expect(blocked.cookie).toBeNull();
    expect(await db.session.count({ where: { userId: created.id } })).toBe(0);

    await enableUser({ userId: created.id, actorId: adminId }, db);
    expect((await signInRequest(email)).status).toBe(200);
    await db.auditLog.deleteMany({ where: { entityType: "User", entityId: created.id } });
  });
});

describe("listing and detail", () => {
  it("filters by query, role, and status, and paginates", async () => {
    const byQuery = await listAdminUsers({ query: runId, role: null, status: null }, 1, db);
    expect(byQuery.total).toBeGreaterThanOrEqual(4);

    const organizers = await listAdminUsers({ query: runId, role: "ORGANIZER", status: null }, 1, db);
    expect(organizers.rows.map((row) => row.id)).toEqual([organizerId]);

    await disableUser({ userId: participantId, actorId: adminId, reason: "Uji filter" }, db);
    const disabled = await listAdminUsers({ query: runId, role: null, status: "disabled" }, 1, db);
    expect(disabled.rows.map((row) => row.id)).toEqual([participantId]);
    expect(disabled.rows[0].providers).toEqual(["google"]);
    const active = await listAdminUsers({ query: runId, role: null, status: "active" }, 1, db);
    expect(active.rows.map((row) => row.id)).not.toContain(participantId);

    const tail = await listAdminUsers({ query: runId, role: null, status: null }, 999, db);
    expect(tail.rows).toEqual([]);
    expect(tail.total).toBe(byQuery.total);
  });

  it("returns detail without session tokens", async () => {
    await addSessions(organizerId, 1);
    const detail = await getAdminUserDetail(participantId, db);
    expect(detail?.registrations).toHaveLength(1);
    expect(detail?.history[0]).toMatchObject({ action: "user.disabled", reason: "Uji filter" });

    const organizer = await getAdminUserDetail(organizerId, db);
    expect(organizer?.events).toHaveLength(1);
    expect(organizer?.sessions.length).toBeGreaterThan(0);
    expect(JSON.stringify(organizer?.sessions)).not.toContain("tok");
    expect(await getAdminUserDetail(`${runId}-none`, db)).toBeNull();
  });
});
