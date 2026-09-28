import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ENV_KEYS = [
  "NODE_ENV",
  "APP_BASE_URL",
  "DATABASE_URL",
  "DIRECT_URL",
  "CRON_SECRET",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "BETTER_AUTH_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "ADMIN_EMAIL",
  "VERCEL_ENV",
  "VERCEL_URL",
] as const;

const originalEnv = { ...process.env };

function clearTrackedEnv() {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

beforeEach(() => {
  vi.resetModules();
  clearTrackedEnv();
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllEnvs();
});

describe("env", () => {
  it("memakai default APP_BASE_URL & NODE_ENV saat variabel opsional kosong", async () => {
    const { env } = await import("@/lib/env");

    expect(env.APP_BASE_URL).toBe("http://localhost:3000");
    expect(env.NODE_ENV).toBe("development");
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.DIRECT_URL).toBeUndefined();
    expect(env.CRON_SECRET).toBeUndefined();
    expect(env.BETTER_AUTH_SECRET).toBeUndefined();
    expect(env.GOOGLE_CLIENT_ID).toBeUndefined();
    expect(env.GOOGLE_CLIENT_SECRET).toBeUndefined();
    expect(env.ADMIN_EMAIL).toBeUndefined();
  });

  it("menolak SUPABASE_URL yang bukan URL", async () => {
    process.env.SUPABASE_URL = "bukan-url";

    await expect(import("@/lib/env")).rejects.toThrow(/SUPABASE_URL/);
  });

  it("menolak ADMIN_EMAIL yang bukan alamat email", async () => {
    process.env.ADMIN_EMAIL = "bukan-email";

    await expect(import("@/lib/env")).rejects.toThrow(/ADMIN_EMAIL/);
  });

  it("menerima APP_BASE_URL yang valid dari process.env", async () => {
    process.env.APP_BASE_URL = "https://event-in.example.com";

    const { env } = await import("@/lib/env");

    expect(env.APP_BASE_URL).toBe("https://event-in.example.com");
  });

  it("menolak APP_BASE_URL yang bukan URL", async () => {
    process.env.APP_BASE_URL = "bukan-url";

    await expect(import("@/lib/env")).rejects.toThrow(/APP_BASE_URL/);
  });

  it("melempar error saat production tanpa APP_BASE_URL", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await expect(import("@/lib/env")).rejects.toThrow(/APP_BASE_URL/);
  });

  it("memakai fallback VERCEL_URL saat preview tanpa APP_BASE_URL", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.VERCEL_ENV = "preview";
    process.env.VERCEL_URL = "event-in-git-preview.vercel.app";

    const { env } = await import("@/lib/env");

    expect(env.APP_BASE_URL).toBe(
      "https://event-in-git-preview.vercel.app",
    );
  });

  it("menolak APP_BASE_URL http di production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.APP_BASE_URL = "http://event-in.example.com";

    await expect(import("@/lib/env")).rejects.toThrow(/https/);
  });

  it("menerima APP_BASE_URL https di production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.APP_BASE_URL = "https://event-in.example.com";

    const { env } = await import("@/lib/env");

    expect(env.APP_BASE_URL).toBe("https://event-in.example.com");
  });
});
