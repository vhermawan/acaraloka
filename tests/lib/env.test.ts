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
  "GOOGLE_PLACES_API_KEY",
  "NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY",
  "EMAIL_ENABLED",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "EMAIL_REPLY_TO",
  "EMAIL_DAILY_BUDGET",
  "AI_ENABLED",
  "AI_MONTHLY_CAP_USD",
  "AI_TRIAL_CAP_USD",
  "AI_TRIAL_ENDS_ON",
  "AI_GENERATION_DEADLINE_MS",
  "AI_GLOBAL_DAILY_LIMIT",
  "AI_IMAGE_PROVIDER",
  "AI_TEXT_PROVIDER",
  "GOOGLE_VERTEX_PROJECT",
  "GOOGLE_VERTEX_LOCATION",
  "GOOGLE_VERTEX_SA_KEY_B64",
  "VERTEX_IMAGE_MODEL",
  "VERTEX_TEXT_MODEL",
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

  it("membaca key Google Maps opsional dan menganggap string kosong sebagai tidak diisi", async () => {
    process.env.GOOGLE_PLACES_API_KEY = "  ";
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY = "embed-key";

    const { env } = await import("@/lib/env");

    expect(env.GOOGLE_PLACES_API_KEY).toBeUndefined();
    expect(env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY).toBe("embed-key");
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
    process.env.APP_BASE_URL = "https://acaraloka.example.com";

    const { env } = await import("@/lib/env");

    expect(env.APP_BASE_URL).toBe("https://acaraloka.example.com");
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
    process.env.VERCEL_URL = "acaraloka-git-preview.vercel.app";

    const { env } = await import("@/lib/env");

    expect(env.APP_BASE_URL).toBe(
      "https://acaraloka-git-preview.vercel.app",
    );
  });

  it("menolak APP_BASE_URL http di production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.APP_BASE_URL = "http://acaraloka.example.com";

    await expect(import("@/lib/env")).rejects.toThrow(/https/);
  });

  it("menerima APP_BASE_URL https di production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.APP_BASE_URL = "https://acaraloka.example.com";

    const { env } = await import("@/lib/env");

    expect(env.APP_BASE_URL).toBe("https://acaraloka.example.com");
  });
});

describe("getDatabaseUrl", () => {
  it("melempar error saat DATABASE_URL kosong", async () => {
    const { getDatabaseUrl } = await import("@/lib/env");

    expect(() => getDatabaseUrl()).toThrow(/DATABASE_URL/);
  });

  it("mengembalikan DATABASE_URL saat terisi", async () => {
    process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";

    const { getDatabaseUrl } = await import("@/lib/env");

    expect(getDatabaseUrl()).toBe("postgresql://user:pass@localhost:5432/db");
  });
});

describe("email env", () => {
  it("mematikan email dan memakai anggaran 95 saat variabel kosong", async () => {
    const { env, getEmailConfig } = await import("@/lib/env");

    expect(env.EMAIL_ENABLED).toBe(false);
    expect(env.EMAIL_DAILY_BUDGET).toBe(95);
    expect(() => getEmailConfig()).toThrow(/EMAIL_ENABLED/);
  });

  it("melempar error saat EMAIL_ENABLED=true tanpa RESEND_API_KEY", async () => {
    process.env.EMAIL_ENABLED = "true";
    process.env.EMAIL_FROM = "Acaraloka <noreply@send.acaraloka.test>";

    await expect(import("@/lib/env")).rejects.toThrow(/RESEND_API_KEY/);
  });

  it("menolak anggaran harian di atas batas Resend free", async () => {
    process.env.EMAIL_DAILY_BUDGET = "500";

    await expect(import("@/lib/env")).rejects.toThrow(/EMAIL_DAILY_BUDGET/);
  });

  it("mengembalikan konfigurasi saat email aktif", async () => {
    process.env.EMAIL_ENABLED = "true";
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "Acaraloka <noreply@send.acaraloka.test>";
    process.env.EMAIL_REPLY_TO = "halo@acaraloka.test";
    process.env.EMAIL_DAILY_BUDGET = "50";

    const { getEmailConfig } = await import("@/lib/env");

    expect(getEmailConfig()).toEqual({
      apiKey: "re_test",
      from: "Acaraloka <noreply@send.acaraloka.test>",
      replyTo: "halo@acaraloka.test",
      dailyBudget: 50,
    });
  });
});

describe("ai env", () => {
  it("mematikan AI dan memakai default aman saat variabel kosong", async () => {
    const { env, getAiLimits } = await import("@/lib/env");

    expect(env.AI_ENABLED).toBe(false);
    expect(env.AI_IMAGE_PROVIDER).toBe("vertex");
    expect(env.AI_TEXT_PROVIDER).toBe("vertex");
    expect(env.GOOGLE_VERTEX_LOCATION).toBe("global");
    expect(env.VERTEX_IMAGE_MODEL).toBe("gemini-nano-banana-2.1");
    expect(env.VERTEX_TEXT_MODEL).toBe("gemini-3.1-flash-lite");
    expect(getAiLimits()).toEqual({
      monthlyCapUsd: 10,
      trialCapUsd: 30,
      trialEndsOn: null,
      globalDailyLimit: 40,
      deadlineMs: 60_000,
    });
  });

  it("melempar error saat AI_ENABLED=true tanpa kredensial Vertex", async () => {
    process.env.AI_ENABLED = "true";
    process.env.GOOGLE_VERTEX_PROJECT = "proyek-uji";

    await expect(import("@/lib/env")).rejects.toThrow(/GOOGLE_VERTEX_SA_KEY_B64/);
  });

  it("melempar error saat AI_ENABLED=true tanpa project Vertex", async () => {
    process.env.AI_ENABLED = "true";
    process.env.GOOGLE_VERTEX_SA_KEY_B64 = "c2VjcmV0";

    await expect(import("@/lib/env")).rejects.toThrow(/GOOGLE_VERTEX_PROJECT/);
  });

  it("menerima AI aktif dengan kredensial lengkap dan membaca batas kustom", async () => {
    process.env.AI_ENABLED = "true";
    process.env.GOOGLE_VERTEX_PROJECT = "proyek-uji";
    process.env.GOOGLE_VERTEX_SA_KEY_B64 = "c2VjcmV0";
    process.env.AI_MONTHLY_CAP_USD = "12.5";
    process.env.AI_TRIAL_CAP_USD = "25";
    process.env.AI_TRIAL_ENDS_ON = "2027-01-31";
    process.env.AI_GLOBAL_DAILY_LIMIT = "20";
    process.env.AI_GENERATION_DEADLINE_MS = "45000";

    const { env, getAiLimits } = await import("@/lib/env");

    expect(env.AI_ENABLED).toBe(true);
    expect(getAiLimits()).toEqual({
      monthlyCapUsd: 12.5,
      trialCapUsd: 25,
      trialEndsOn: "2027-01-31",
      globalDailyLimit: 20,
      deadlineMs: 45_000,
    });
  });

  it("menolak tanggal akhir trial yang tidak valid", async () => {
    process.env.AI_TRIAL_ENDS_ON = "31-01-2027";

    await expect(import("@/lib/env")).rejects.toThrow(/AI_TRIAL_ENDS_ON/);
  });

  it("menolak cap negatif dan deadline di luar rentang", async () => {
    process.env.AI_MONTHLY_CAP_USD = "-1";
    await expect(import("@/lib/env")).rejects.toThrow(/AI_MONTHLY_CAP_USD/);

    vi.resetModules();
    delete process.env.AI_MONTHLY_CAP_USD;
    process.env.AI_GENERATION_DEADLINE_MS = "500";
    await expect(import("@/lib/env")).rejects.toThrow(/AI_GENERATION_DEADLINE_MS/);
  });

  it("tidak membocorkan nilai kredensial di pesan error", async () => {
    process.env.AI_ENABLED = "true";
    process.env.GOOGLE_VERTEX_SA_KEY_B64 = "rahasia-sangat";

    await expect(import("@/lib/env")).rejects.not.toThrow(/rahasia-sangat/);
  });
});
