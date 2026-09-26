import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ENV_KEYS = [
  "NODE_ENV",
  "APP_BASE_URL",
  "DATABASE_URL",
  "CRON_SECRET",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
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
});

describe("env", () => {
  it("memakai default APP_BASE_URL & NODE_ENV saat variabel opsional kosong", async () => {
    const { env } = await import("@/lib/env");

    expect(env.APP_BASE_URL).toBe("http://localhost:3000");
    expect(env.NODE_ENV).toBe("development");
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.CRON_SECRET).toBeUndefined();
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
});
