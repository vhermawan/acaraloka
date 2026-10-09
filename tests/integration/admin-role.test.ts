import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, describe, expect, it, vi } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { detectRoleConflict, parseRole } from "@/lib/roles";

process.env.EMAIL_ENABLED = "true";
process.env.RESEND_API_KEY = "re_integration_unused";
process.env.EMAIL_FROM = "Acaraloka <noreply@send.acaraloka.test>";

vi.mock("@/server/email-schedule", () => ({ scheduleEmailDrain: vi.fn() }));

const { auth } = await import("@/lib/auth");

const runId = `adm${Date.now()}`;
const domain = `${runId}.test`;
const ORIGIN = "http://localhost:3000";
const PASSWORD = "kata-sandi-aman-1";
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 }) });

let counter = 0;
const nextEmail = (label: string) => `${label}-${(counter += 1)}@${domain}`;

type Json = Record<string, unknown>;

async function call(path: string, body?: Json) {
  const response = await auth.handler(
    new Request(`${ORIGIN}/api/auth${path}`, {
      method: body ? "POST" : "GET",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body: body ? JSON.stringify(body) : undefined,
      redirect: "manual",
    }),
  );
  const text = await response.text();
  let json: Json | null = null;
  try {
    json = text ? (JSON.parse(text) as Json) : null;
  } catch {
    json = null;
  }
  return { status: response.status, json, cookie: response.headers.get("set-cookie") };
}

function signUp(email: string, intent: string) {
  return call("/sign-up/email", {
    name: "Budi Uji",
    email,
    password: PASSWORD,
    intent,
    acceptTerms: true,
    callbackURL: "/auth/continue?intent=participant",
  });
}

async function verifiedSession(email: string) {
  const outbox = await db.emailOutbox.findMany({ where: { to: email, template: "verify-email" } });
  const { verifyPath } = outbox[outbox.length - 1].payload as { verifyPath: string };
  await call(verifyPath.replace("/api/auth", ""));
  const login = await call("/sign-in/email", { email, password: PASSWORD });
  expect(login.status).toBe(200);
  return auth.api.getSession({ headers: new Headers({ cookie: login.cookie!.split(";")[0] }) });
}

afterAll(async () => {
  await db.emailOutbox.deleteMany({ where: { to: { endsWith: `@${domain}` } } });
  await db.user.deleteMany({ where: { email: { endsWith: `@${domain}` } } });
  await db.rateLimit.deleteMany({ where: { key: { contains: runId } } });
  await db.$disconnect();
});

describe("admin accounts", () => {
  it("never creates an account from the admin sign-up intent", async () => {
    const email = nextEmail("admin-baru");
    const result = await signUp(email, "ADMIN");
    expect(result.status).toBe(403);
    expect(result.json?.code).toBe("ADMIN_SIGNUP_FORBIDDEN");
    expect(await db.user.findUnique({ where: { email } })).toBeNull();
    expect(await db.emailOutbox.count({ where: { to: email } })).toBe(0);
  });

  it("does not mail or touch an existing account when the admin intent is used", async () => {
    const email = nextEmail("sudah-ada");
    expect((await signUp(email, "PARTICIPANT")).status).toBe(200);
    const mailsBefore = await db.emailOutbox.count({ where: { to: email } });

    const result = await signUp(email, "admin");
    expect(result.status).toBe(403);
    expect(await db.user.count({ where: { email } })).toBe(1);
    expect((await db.user.findUniqueOrThrow({ where: { email } })).role).toBe("PARTICIPANT");
    expect(await db.emailOutbox.count({ where: { to: email } })).toBe(mailsBefore);
  });

  it("keeps a non-admin session out of the admin area and an admin session out of the other areas", async () => {
    const email = nextEmail("peran");
    await signUp(email, "PARTICIPANT");
    const participant = await verifiedSession(email);
    expect(detectRoleConflict(parseRole(participant!.user.role), "ADMIN")).toBe("role-not-admin");

    await db.user.update({ where: { email }, data: { role: "ADMIN" } });
    const login = await call("/sign-in/email", { email, password: PASSWORD });
    const admin = await auth.api.getSession({ headers: new Headers({ cookie: login.cookie!.split(";")[0] }) });
    expect(parseRole(admin!.user.role)).toBe("ADMIN");
    expect(detectRoleConflict("ADMIN", "ADMIN")).toBeNull();
    expect(detectRoleConflict(parseRole(admin!.user.role), "PARTICIPANT")).toBe("role-admin");
    expect(detectRoleConflict(parseRole(admin!.user.role), "ORGANIZER")).toBe("role-admin");
  });
});

describe("admin role backfill migration", () => {
  const migration = readFileSync(
    join(process.cwd(), "prisma/migrations/20261009160100_admin_role_backfill/migration.sql"),
    "utf8",
  );
  const backfill = migration
    .replace(/^--.*$/gm, "")
    .split(";")
    .map((statement) => statement.trim())
    .find((statement) => statement.startsWith("UPDATE"));

  it("promotes only flagged accounts to ADMIN and leaves other roles alone", async () => {
    expect(backfill).toBeDefined();
    class Rollback extends Error {}
    let rows: { id: string; role: string }[] = [];

    await db
      .$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `CREATE TEMP TABLE "user" ("id" text, "isAdmin" boolean DEFAULT false, "role" "UserRole" NOT NULL DEFAULT 'PARTICIPANT') ON COMMIT DROP`,
        );
        await tx.$executeRawUnsafe(
          `INSERT INTO "user" ("id", "isAdmin", "role") VALUES
            ('admin-flagged', true, 'PARTICIPANT'),
            ('admin-flagged-organizer', true, 'ORGANIZER'),
            ('plain-participant', false, 'PARTICIPANT'),
            ('unset-flag', NULL, 'PARTICIPANT'),
            ('plain-organizer', false, 'ORGANIZER')`,
        );
        await tx.$executeRawUnsafe(backfill!);
        rows = await tx.$queryRawUnsafe(`SELECT "id", "role"::text AS "role" FROM "user" ORDER BY "id"`);
        throw new Rollback();
      })
      .catch((error) => {
        if (!(error instanceof Rollback)) throw error;
      });

    expect(rows).toEqual([
      { id: "admin-flagged", role: "ADMIN" },
      { id: "admin-flagged-organizer", role: "ADMIN" },
      { id: "plain-organizer", role: "ORGANIZER" },
      { id: "plain-participant", role: "PARTICIPANT" },
      { id: "unset-flag", role: "PARTICIPANT" },
    ]);
  });
});
