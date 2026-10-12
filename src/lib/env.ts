import "server-only";
import { z } from "zod";

const DEV_DEFAULT_APP_BASE_URL = "http://localhost:3000";

function resolveAppBaseUrl(): string {
  const nodeEnv = process.env.NODE_ENV;
  const rawAppBaseUrl = process.env.APP_BASE_URL?.trim();

  if (nodeEnv !== "production") {
    return rawAppBaseUrl || DEV_DEFAULT_APP_BASE_URL;
  }

  if (rawAppBaseUrl) {
    return rawAppBaseUrl;
  }

  const vercelEnv = process.env.VERCEL_ENV;
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelEnv === "preview" && vercelUrl) {
    return `https://${vercelUrl}`;
  }

  throw new Error(
    "APP_BASE_URL wajib diisi saat NODE_ENV=production (termasuk `next build`/`next start` " +
      "lokal). Variabel ini dipakai untuk URL QR sertifikat permanen — kalau salah, QR yang " +
      "sudah tercetak bisa mengarah ke alamat yang salah. Isi APP_BASE_URL di environment " +
      "Vercel (Production) atau .env.local sebelum build. Lihat .env.example.",
  );
}

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  APP_BASE_URL: z.string().url(),

  DATABASE_URL: z.string().min(1).optional(),
  DIRECT_URL: z.string().min(1).optional(),

  CRON_SECRET: z.string().min(1).optional(),

  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),

  BETTER_AUTH_SECRET: z.string().min(1).optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),

  ADMIN_EMAIL: z.string().email().optional(),

  CLOUDFLARE_ANALYTICS_TOKEN: z.string().min(1).optional(),

  GOOGLE_PLACES_API_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY: z.string().min(1).optional(),

  EMAIL_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(3).optional(),
  EMAIL_REPLY_TO: z.string().email().optional(),
  EMAIL_DAILY_BUDGET: z.coerce.number().int().min(1).max(100).default(95),

  AI_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  AI_MONTHLY_CAP_USD: z.coerce.number().positive().default(10),
  AI_TRIAL_CAP_USD: z.coerce.number().positive().default(30),
  AI_TRIAL_ENDS_ON: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)))
    .optional(),
  AI_GENERATION_DEADLINE_MS: z.coerce.number().int().min(10_000).max(110_000).default(60_000),
  AI_GLOBAL_DAILY_LIMIT: z.coerce.number().int().min(1).default(40),
  AI_IMAGE_PROVIDER: z.enum(["vertex"]).default("vertex"),
  AI_TEXT_PROVIDER: z.enum(["vertex"]).default("vertex"),
  GOOGLE_VERTEX_PROJECT: z.string().min(1).optional(),
  GOOGLE_VERTEX_LOCATION: z.string().min(1).default("global"),
  GOOGLE_VERTEX_SA_KEY_B64: z.string().min(1).optional(),
  VERTEX_IMAGE_MODEL: z.string().min(1).default("gemini-nano-banana-2.1"),
  VERTEX_TEXT_MODEL: z.string().min(1).default("gemini-3.1-flash-lite"),
});

function loadEnv() {
  const appBaseUrl = resolveAppBaseUrl();

  const parsed = envSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    APP_BASE_URL: appBaseUrl,
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    CRON_SECRET: process.env.CRON_SECRET,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    CLOUDFLARE_ANALYTICS_TOKEN: process.env.CLOUDFLARE_ANALYTICS_TOKEN || undefined,
    GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY?.trim() || undefined,
    NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY?.trim() || undefined,
    EMAIL_ENABLED: process.env.EMAIL_ENABLED?.trim() || undefined,
    RESEND_API_KEY: process.env.RESEND_API_KEY || undefined,
    EMAIL_FROM: process.env.EMAIL_FROM?.trim() || undefined,
    EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO?.trim() || undefined,
    EMAIL_DAILY_BUDGET: process.env.EMAIL_DAILY_BUDGET?.trim() || undefined,
    AI_ENABLED: process.env.AI_ENABLED?.trim() || undefined,
    AI_MONTHLY_CAP_USD: process.env.AI_MONTHLY_CAP_USD?.trim() || undefined,
    AI_TRIAL_CAP_USD: process.env.AI_TRIAL_CAP_USD?.trim() || undefined,
    AI_TRIAL_ENDS_ON: process.env.AI_TRIAL_ENDS_ON?.trim() || undefined,
    AI_GENERATION_DEADLINE_MS: process.env.AI_GENERATION_DEADLINE_MS?.trim() || undefined,
    AI_GLOBAL_DAILY_LIMIT: process.env.AI_GLOBAL_DAILY_LIMIT?.trim() || undefined,
    AI_IMAGE_PROVIDER: process.env.AI_IMAGE_PROVIDER?.trim() || undefined,
    AI_TEXT_PROVIDER: process.env.AI_TEXT_PROVIDER?.trim() || undefined,
    GOOGLE_VERTEX_PROJECT: process.env.GOOGLE_VERTEX_PROJECT?.trim() || undefined,
    GOOGLE_VERTEX_LOCATION: process.env.GOOGLE_VERTEX_LOCATION?.trim() || undefined,
    GOOGLE_VERTEX_SA_KEY_B64: process.env.GOOGLE_VERTEX_SA_KEY_B64?.trim() || undefined,
    VERTEX_IMAGE_MODEL: process.env.VERTEX_IMAGE_MODEL?.trim() || undefined,
    VERTEX_TEXT_MODEL: process.env.VERTEX_TEXT_MODEL?.trim() || undefined,
  });

  if (!parsed.success) {
    const invalidFields = Object.keys(parsed.error.flatten().fieldErrors);
    throw new Error(
      `Environment variable tidak valid: ${invalidFields.join(", ")}. Cek .env.example untuk daftar nama variabel.`,
    );
  }

  if (parsed.data.NODE_ENV === "production" && !parsed.data.APP_BASE_URL.startsWith("https://")) {
    throw new Error(
      "APP_BASE_URL harus memakai https:// saat NODE_ENV=production, karena URL ini dicetak " +
        "sebagai QR sertifikat permanen. Ganti ke URL https, atau perbaiki konfigurasi deploy.",
    );
  }

  if (parsed.data.EMAIL_ENABLED && (!parsed.data.RESEND_API_KEY || !parsed.data.EMAIL_FROM)) {
    throw new Error(
      "EMAIL_ENABLED=true butuh RESEND_API_KEY dan EMAIL_FROM. Isi keduanya, atau set EMAIL_ENABLED=false.",
    );
  }

  if (
    parsed.data.AI_ENABLED &&
    (!parsed.data.GOOGLE_VERTEX_PROJECT || !parsed.data.GOOGLE_VERTEX_SA_KEY_B64)
  ) {
    throw new Error(
      "AI_ENABLED=true butuh GOOGLE_VERTEX_PROJECT dan GOOGLE_VERTEX_SA_KEY_B64. Isi keduanya, atau set AI_ENABLED=false.",
    );
  }

  return parsed.data;
}

export const env = loadEnv();

export function getDatabaseUrl(): string {
  if (!env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL belum diisi. Prisma butuh connection string transaction pooler Supabase. Lihat .env.example.",
    );
  }

  return env.DATABASE_URL;
}

export function getAuthConfig() {
  const { BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = env;

  if (!BETTER_AUTH_SECRET || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error(
      "BETTER_AUTH_SECRET, GOOGLE_CLIENT_ID, dan GOOGLE_CLIENT_SECRET wajib diisi untuk login. Lihat .env.example.",
    );
  }

  return {
    secret: BETTER_AUTH_SECRET,
    googleClientId: GOOGLE_CLIENT_ID,
    googleClientSecret: GOOGLE_CLIENT_SECRET,
  };
}

export function getEmailConfig() {
  const { EMAIL_ENABLED, RESEND_API_KEY, EMAIL_FROM, EMAIL_REPLY_TO, EMAIL_DAILY_BUDGET } = env;

  if (!EMAIL_ENABLED || !RESEND_API_KEY || !EMAIL_FROM) {
    throw new Error("Email belum aktif. Set EMAIL_ENABLED=true beserta RESEND_API_KEY dan EMAIL_FROM.");
  }

  return { apiKey: RESEND_API_KEY, from: EMAIL_FROM, replyTo: EMAIL_REPLY_TO, dailyBudget: EMAIL_DAILY_BUDGET };
}

export function getAiLimits() {
  const { AI_MONTHLY_CAP_USD, AI_TRIAL_CAP_USD, AI_TRIAL_ENDS_ON, AI_GLOBAL_DAILY_LIMIT, AI_GENERATION_DEADLINE_MS } = env;

  return {
    monthlyCapUsd: AI_MONTHLY_CAP_USD,
    trialCapUsd: AI_TRIAL_CAP_USD,
    trialEndsOn: AI_TRIAL_ENDS_ON ?? null,
    globalDailyLimit: AI_GLOBAL_DAILY_LIMIT,
    deadlineMs: AI_GENERATION_DEADLINE_MS,
  };
}
