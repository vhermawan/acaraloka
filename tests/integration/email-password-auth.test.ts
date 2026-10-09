import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { detectRoleConflict, parseRole } from "@/lib/roles";
import { TERMS_VERSION } from "@/lib/legal";

process.env.EMAIL_ENABLED = "true";
process.env.RESEND_API_KEY = "re_integration_unused";
process.env.EMAIL_FROM = "Acaraloka <noreply@send.acaraloka.test>";

vi.mock("@/server/email-schedule", () => ({ scheduleEmailDrain: vi.fn() }));

const { auth } = await import("@/lib/auth");
const { betterAuth } = await import("better-auth");
const { canRegisterFreeTicket } = await import("@/server/authz");

const runId = `pw${Date.now()}`;
const domain = `${runId}.test`;
const ORIGIN = "http://localhost:3000";
const PASSWORD = "kata-sandi-aman-1";
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 }) });

let counter = 0;
const nextEmail = (label: string) => `${label}-${(counter += 1)}@${domain}`;

type Json = Record<string, unknown>;

async function call(
  path: string,
  options: { method?: string; body?: Json; headers?: Record<string, string>; handler?: (request: Request) => Promise<Response> } = {},
) {
  const request = new Request(`${ORIGIN}/api/auth${path}`, {
    method: options.method ?? (options.body ? "POST" : "GET"),
    headers: { "content-type": "application/json", origin: ORIGIN, ...options.headers },
    body: options.body ? JSON.stringify(options.body) : undefined,
    redirect: "manual",
  });
  const response = await (options.handler ?? auth.handler)(request);
  const text = await response.text();
  let json: Json | null = null;
  try {
    json = text ? (JSON.parse(text) as Json) : null;
  } catch {
    json = null;
  }
  return { status: response.status, json, location: response.headers.get("location"), cookie: response.headers.get("set-cookie") };
}

function signUp(email: string, intent: "PARTICIPANT" | "ORGANIZER" | "ADMIN", extra: Json = {}, password = PASSWORD) {
  return call("/sign-up/email", {
    body: { name: "Budi Uji", email, password, intent, acceptTerms: true, callbackURL: "/auth/continue?intent=participant", ...extra },
  });
}

const signIn = (email: string, password = PASSWORD) => call("/sign-in/email", { body: { email, password } });

async function outboxFor(email: string, template?: string) {
  const rows = await db.emailOutbox.findMany({ where: { to: email, ...(template ? { template } : {}) }, orderBy: { createdAt: "asc" } });
  return rows;
}

async function verifyPathFor(email: string) {
  const rows = await outboxFor(email, "verify-email");
  const payload = rows[rows.length - 1].payload as { verifyPath: string };
  return payload.verifyPath;
}

async function verify(email: string) {
  return call((await verifyPathFor(email)).replace("/api/auth", ""));
}

async function resetTokenFor(email: string) {
  const rows = await outboxFor(email, "reset-password");
  const payload = rows[rows.length - 1].payload as { resetPath: string };
  return new URL(payload.resetPath, ORIGIN).pathname.split("/").pop()!;
}

beforeAll(async () => {
  await db.emailOutbox.deleteMany({ where: { to: { endsWith: ".test" }, status: { in: ["PENDING", "SENDING"] } } });
});

afterAll(async () => {
  await db.emailOutbox.deleteMany({ where: { to: { endsWith: `@${domain}` } } });
  await db.user.deleteMany({ where: { email: { endsWith: `@${domain}` } } });
  await db.rateLimit.deleteMany({ where: { key: { contains: runId } } });
  await db.$disconnect();
});

describe("email and password auth", () => {
  it("rejects login before verification, then allows it after the emailed link", async () => {
    const email = nextEmail("alur");
    const created = await signUp(email, "PARTICIPANT");
    expect(created.status).toBe(200);
    expect(created.cookie).toBeNull();

    const user = await db.user.findUniqueOrThrow({ where: { email } });
    expect(user).toMatchObject({ role: "PARTICIPANT", emailVerified: false, termsVersion: TERMS_VERSION });
    expect(user.termsAcceptedAt).toBeInstanceOf(Date);
    expect(canRegisterFreeTicket(user)).toBe(false);

    const [mail] = await outboxFor(email, "verify-email");
    expect(mail).toMatchObject({ priority: 0, status: "PENDING" });
    expect(mail.dedupeKey).toMatch(/^verify-email:/);

    const blocked = await signIn(email);
    expect(blocked.status).toBe(403);
    expect(blocked.json?.code).toBe("EMAIL_NOT_VERIFIED");
    expect(blocked.cookie).toBeNull();

    const verified = await verify(email);
    expect(verified.status).toBe(302);
    expect(verified.location).toBe("/auth/continue?intent=participant");
    expect(verified.cookie).toContain("session_token");
    const after = await db.user.findUniqueOrThrow({ where: { email } });
    expect(canRegisterFreeTicket(after)).toBe(true);

    const ok = await signIn(email);
    expect(ok.status).toBe(200);
    expect(ok.cookie).toContain("session_token");
    expect((await signIn(email, "salah-salah-1")).status).toBe(401);
  });

  it("assigns the role from the signup page and rejects client-supplied privileged fields", async () => {
    const organizer = nextEmail("panitia");
    await signUp(organizer, "ORGANIZER");
    expect((await db.user.findUniqueOrThrow({ where: { email: organizer } })).role).toBe("ORGANIZER");

    const sneaky = nextEmail("nakal");
    const rejected = await signUp(sneaky, "PARTICIPANT", {
      role: "ADMIN",
      termsVersion: "1999-01-01",
      disabledAt: new Date().toISOString(),
    });
    expect(rejected.status).toBe(400);
    expect(rejected.json?.code).toBe("FIELD_NOT_ALLOWED");
    expect(await db.user.findUnique({ where: { email: sneaky } })).toBeNull();
  });

  it("requires accepting the terms and an 8 character password", async () => {
    const email = nextEmail("syarat");
    const noTerms = await signUp(email, "PARTICIPANT", { acceptTerms: false });
    expect(noTerms.status).toBe(400);
    expect(noTerms.json?.code).toBe("TERMS_NOT_ACCEPTED");
    expect(await db.user.findUnique({ where: { email } })).toBeNull();

    const short = await signUp(email, "PARTICIPANT", {}, "pendek");
    expect(short.status).toBe(400);
    expect(await db.user.findUnique({ where: { email } })).toBeNull();
  });

  it("treats an organizer email as a role conflict on the participant page", async () => {
    const email = nextEmail("bentrok");
    await signUp(email, "ORGANIZER");
    await verify(email);
    const login = await signIn(email);
    expect(login.status).toBe(200);

    const session = await auth.api.getSession({ headers: new Headers({ cookie: login.cookie!.split(";")[0] }) });
    expect(detectRoleConflict(parseRole(session!.user.role), "PARTICIPANT")).toBe("role-organizer");
    expect(detectRoleConflict(parseRole(session!.user.role), "ORGANIZER")).toBeNull();
  });

  it("ignores server-owned fields sent to update-user", async () => {
    const email = nextEmail("kunci");
    await signUp(email, "PARTICIPANT");
    await verify(email);
    const login = await signIn(email);
    const cookie = login.cookie!.split(";")[0];
    const disabledAt = new Date("2030-01-01T00:00:00Z");
    await db.user.update({ where: { email }, data: { disabledAt } });
    const before = await db.user.findUniqueOrThrow({ where: { email } });

    const forbidden: Json[] = [
      { termsVersion: "1999-01-01" },
      { termsAcceptedAt: new Date("1999-01-01").toISOString() },
      { phone: "081200000000" },
      { role: "ORGANIZER" },
      { role: "ADMIN" },
    ];
    for (const body of forbidden) {
      const res = await call("/update-user", { headers: { cookie }, body: { name: "Nama Baru", ...body } });
      expect(res.status).toBe(400);
      expect(res.json?.code).toBe("FIELD_NOT_ALLOWED");
    }

    const cleared = await call("/update-user", { headers: { cookie }, body: { name: "Nama Baru", disabledAt: null } });
    expect(cleared.status).toBe(200);
    const after = await db.user.findUniqueOrThrow({ where: { email } });
    expect(after.disabledAt).toEqual(disabledAt);
    expect(after.name).toBe("Nama Baru");
    expect({ ...after, name: null, updatedAt: null }).toEqual({ ...before, name: null, updatedAt: null });
  });

  it("lets the server rewrite terms acceptance directly", async () => {
    const email = nextEmail("setuju");
    await signUp(email, "PARTICIPANT");
    await db.user.update({ where: { email }, data: { termsVersion: "1999-01-01", termsAcceptedAt: null } });
    await db.user.update({ where: { email }, data: { termsVersion: TERMS_VERSION, termsAcceptedAt: new Date() } });
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    expect(user.termsVersion).toBe(TERMS_VERSION);
    expect(user.termsAcceptedAt).toBeInstanceOf(Date);
  });

  it("does not reveal existing emails on signup and mails the owner instead", async () => {
    const email = nextEmail("ada");
    await signUp(email, "PARTICIPANT");
    await verify(email);

    const again = await signUp(email, "ORGANIZER", {}, "password-lain-1");
    expect(again.status).toBe(200);
    expect(again.json?.token).toBeNull();
    expect(await db.user.count({ where: { email } })).toBe(1);
    expect((await db.user.findUniqueOrThrow({ where: { email } })).role).toBe("PARTICIPANT");

    const [notice] = await outboxFor(email, "account-exists");
    expect(notice.payload).toMatchObject({ reason: "signup", method: "password", loginPath: "/login" });
    expect((await signIn(email, "password-lain-1")).status).toBe(401);
    expect((await signIn(email)).status).toBe(200);
  });

  it("points Google-only accounts to Google on signup, login and reset", async () => {
    const email = nextEmail("google");
    const id = `${runId}-google`;
    await db.user.create({ data: { id, name: "Pengguna Google", email, emailVerified: true } });
    await db.account.create({ data: { id: `${id}-acc`, accountId: "g-123", providerId: "google", userId: id } });

    await signUp(email, "PARTICIPANT");
    const [signup] = await outboxFor(email, "account-exists");
    expect(signup.payload).toMatchObject({ reason: "signup", method: "google" });

    const login = await signIn(email);
    expect(login.status).toBe(401);
    expect(login.json?.code).toBe("INVALID_EMAIL_OR_PASSWORD");

    const reset = await call("/request-password-reset", { body: { email, redirectTo: "/reset-password" } });
    expect(reset.status).toBe(200);
    expect(await outboxFor(email, "reset-password")).toHaveLength(0);
    const notices = await outboxFor(email, "account-exists");
    expect(notices.map((row) => (row.payload as { reason: string }).reason).sort()).toEqual(["reset", "signup"]);
  });

  it("replaces an unverified signup so the first password and link never work", async () => {
    const email = nextEmail("rebut");
    await signUp(email, "PARTICIPANT", {}, "password-penyerang-1");
    const staleLink = await verifyPathFor(email);
    const attackerId = (await db.user.findUniqueOrThrow({ where: { email } })).id;

    await new Promise((resolve) => setTimeout(resolve, 1100));
    await signUp(email, "PARTICIPANT", {}, "password-korban-123");
    const owner = await db.user.findUniqueOrThrow({ where: { email } });
    expect(owner.id).not.toBe(attackerId);

    const stale = await call(staleLink.replace("/api/auth", ""));
    expect(stale.status).toBe(302);
    expect(stale.location).toBe("/login?error=verify-expired");
    expect((await db.user.findUniqueOrThrow({ where: { email } })).emailVerified).toBe(false);

    await verify(email);
    expect((await signIn(email, "password-penyerang-1")).status).toBe(401);
    expect((await signIn(email, "password-korban-123")).status).toBe(200);
  });

  it("keeps an unverified account that has Google, registrations, an organizer profile or no account", async () => {
    const google = nextEmail("tautan");
    const withRegistration = nextEmail("tiket");
    const orphan = nextEmail("yatim");
    const organizer = nextEmail("profil");
    const ids = { google: `${runId}-g2`, registration: `${runId}-r2`, orphan: `${runId}-o2`, organizer: `${runId}-p2` };
    await db.user.createMany({
      data: [
        { id: ids.google, name: "G", email: google },
        { id: ids.registration, name: "R", email: withRegistration },
        { id: ids.orphan, name: "O", email: orphan },
        { id: ids.organizer, name: "P", email: organizer },
      ],
    });
    await db.account.createMany({
      data: [
        { id: `${ids.google}-a`, accountId: "g", providerId: "google", userId: ids.google },
        { id: `${ids.google}-b`, accountId: ids.google, providerId: "credential", userId: ids.google, password: "x" },
        { id: `${ids.registration}-a`, accountId: ids.registration, providerId: "credential", userId: ids.registration, password: "x" },
        { id: `${ids.organizer}-a`, accountId: ids.organizer, providerId: "credential", userId: ids.organizer, password: "x" },
      ],
    });
    await db.organizerProfile.create({ data: { userId: ids.organizer, orgName: "Uji", contactPhone: "081234567890" } });
    const event = await db.event.create({
      data: {
        organizerId: ids.organizer,
        slug: `${runId}-ev`,
        title: "Uji",
        description: "Uji",
        startAt: new Date(Date.now() + 86_400_000),
        endAt: new Date(Date.now() + 90_000_000),
        venue: "Aula",
        status: "PUBLISHED",
        ticketTypes: { create: { name: "Umum", quota: 5 } },
      },
      include: { ticketTypes: true },
    });
    await db.registration.create({
      data: {
        eventId: event.id,
        ticketTypeId: event.ticketTypes[0].id,
        userId: ids.registration,
        name: "R",
        email: withRegistration,
        phone: "081234567890",
        consentAt: new Date(),
        ticketCode: `${runId}-code`,
      },
    });

    for (const email of [google, withRegistration, orphan, organizer]) {
      const result = await signUp(email, "PARTICIPANT", {}, "password-lain-1");
      expect(result.status).toBe(200);
      expect(result.json?.token).toBeNull();
      expect(await db.user.count({ where: { email } })).toBe(1);
    }
    expect((await db.user.findUniqueOrThrow({ where: { email: google } })).id).toBe(ids.google);

    await db.registration.deleteMany({ where: { eventId: event.id } });
    await db.event.deleteMany({ where: { id: event.id } });
    await db.organizerProfile.deleteMany({ where: { userId: ids.organizer } });
  });

  it("does not delete a pending signup when the new request is invalid", async () => {
    const email = nextEmail("valid");
    await signUp(email, "PARTICIPANT");
    const original = await db.user.findUniqueOrThrow({ where: { email } });

    const bodies: Json[] = [
      { password: "pendek" },
      { password: "x".repeat(200) },
      { name: "   " },
      { acceptTerms: false },
      { email: `${email} bukan-email` },
    ];
    for (const extra of bodies) {
      const result = await signUp(email, "PARTICIPANT", extra);
      expect(result.status).toBe(400);
      expect((await db.user.findUniqueOrThrow({ where: { email } })).id).toBe(original.id);
    }
  });

  it("caps verification and reset emails per address per hour", async () => {
    const email = nextEmail("batas");
    await signUp(email, "PARTICIPANT");
    for (let attempt = 0; attempt < 18; attempt += 1) {
      for (const row of await outboxFor(email)) {
        await db.emailOutbox.update({ where: { id: row.id }, data: { dedupeKey: `${runId}:cap:${attempt}:${row.id}` } });
      }
      await signIn(email);
    }
    expect(await outboxFor(email, "verify-email")).toHaveLength(15);
    const dropped = await db.errorLog.findFirst({ where: { source: "email.auth-cap" } });
    expect(dropped?.level).toBe("warn");
    expect(JSON.stringify(dropped)).not.toContain(email);
  });

  it("resets the password once, revokes the old one and verifies the mailbox", async () => {
    const email = nextEmail("reset");
    await signUp(email, "PARTICIPANT");

    const requested = await call("/request-password-reset", { body: { email, redirectTo: "/reset-password?intent=participant" } });
    expect(requested.status).toBe(200);
    const [mail] = await outboxFor(email, "reset-password");
    expect(mail.priority).toBe(0);
    const token = await resetTokenFor(email);

    const landing = await call(`/reset-password/${token}?callbackURL=${encodeURIComponent("/reset-password?intent=participant")}`);
    expect(landing.location).toContain(`/reset-password?intent=participant&token=${token}`);

    const changed = await call("/reset-password", { body: { token, newPassword: "kata-sandi-baru-2" } });
    expect(changed.status).toBe(200);
    expect((await db.user.findUniqueOrThrow({ where: { email } })).emailVerified).toBe(true);
    expect((await signIn(email)).status).toBe(401);
    expect((await signIn(email, "kata-sandi-baru-2")).status).toBe(200);

    const reused = await call("/reset-password", { body: { token, newPassword: "kata-sandi-baru-3" } });
    expect(reused.status).toBe(400);
  });

  it("answers password reset for unknown emails exactly like known ones", async () => {
    const known = nextEmail("dikenal");
    await signUp(known, "PARTICIPANT");
    const a = await call("/request-password-reset", { body: { email: known } });
    const b = await call("/request-password-reset", { body: { email: nextEmail("asing") } });
    expect(b).toMatchObject({ status: a.status, json: a.json });
  });

  it("dedupes verification emails inside one minute and sends again after it", async () => {
    const email = nextEmail("kirim");
    await signUp(email, "PARTICIPANT");
    await signIn(email);
    expect(await outboxFor(email, "verify-email")).toHaveLength(1);

    await db.emailOutbox.updateMany({ where: { to: email }, data: { dedupeKey: `${runId}:old:${email}` } });
    await signIn(email);
    expect(await outboxFor(email, "verify-email")).toHaveLength(2);
  });

  it("only links Google to password accounts whose email is verified", () => {
    expect(auth.options.account?.accountLinking).toMatchObject({ enabled: true, requireLocalEmailVerified: true });
  });
});

describe("auth rate limiting", () => {
  it("stores counters in the database and blocks after the limit", async () => {
    expect(auth.options.rateLimit).toMatchObject({ storage: "database" });
    const limited = betterAuth({ ...auth.options, rateLimit: { ...auth.options.rateLimit, enabled: true } });
    const ip = `203.0.113.${(Date.now() % 200) + 1}`;
    const headers = { "x-forwarded-for": ip };
    const email = nextEmail("limit");

    const statuses: number[] = [];
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const result = await call("/sign-in/email", { body: { email, password: "apa-saja-123" }, headers, handler: limited.handler });
      statuses.push(result.status);
    }

    expect(statuses.slice(0, 10).every((status) => status === 401)).toBe(true);
    expect(statuses.slice(10)).toEqual([429, 429]);
    await db.rateLimit.deleteMany({ where: { key: { contains: ip } } });
  });
});
