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

  return parsed.data;
}

export const env = loadEnv();
