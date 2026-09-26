import "server-only";
import { z } from "zod";

/**
 * Validasi terpusat untuk environment variable.
 *
 * Catatan penting:
 * - Modul ini hanya boleh diimpor dari kode server (Server Component,
 *   Server Action, Route Handler). Jangan diimpor dari Client Component.
 *   Diberi penanda `import "server-only"` agar bundler Next.js menolak
 *   modul ini kalau tidak sengaja ikut ke bundle client.
 * - Setiap field diambil lewat referensi literal `process.env.NAMA_VAR`
 *   (bukan spread objek `process.env`), supaya kalau kelak ada variabel
 *   `NEXT_PUBLIC_*` yang memang harus dibaca dari Client Component,
 *   Next.js tetap bisa meng-inline nilainya saat build.
 * - Variabel yang belum dipakai fitur apa pun (Supabase, database, cron)
 *   dibuat opsional agar `next dev`/`next build` tidak gagal sebelum
 *   `.env.local` diisi. Skema diperketat (jadi wajib) saat fitur yang
 *   memakainya mulai dikerjakan.
 * - Modul ini tidak pernah mencetak nilai variabel, hanya nama field yang
 *   gagal validasi, supaya secret tidak bocor ke log.
 *
 * Aturan khusus `APP_BASE_URL` (dipakai untuk URL QR sertifikat permanen,
 * risiko Tinggi di rencana — salah konfigurasi harus gagal keras, bukan
 * diam-diam memakai `localhost`):
 * - Development/test (`NODE_ENV` bukan `production`): boleh kosong, default
 *   ke `http://localhost:3000`.
 * - Production (`NODE_ENV=production`, dipakai Next.js untuk `next build`
 *   maupun `next start`, baik di Vercel maupun platform lain): WAJIB diisi.
 *   Kalau kosong, modul ini melempar error yang jelas alih-alih diam-diam
 *   memakai `localhost`. Konsekuensinya, `npm run build` di lokal tanpa
 *   `.env.local` juga akan gagal dengan pesan jelas — ini disengaja
 *   (fail-loud), bukan bug. Isi `APP_BASE_URL` (boleh nilai apa pun yang
 *   valid, mis. `http://localhost:3000`) kalau hanya ingin build lokal.
 * - Kecuali di Vercel Preview (`VERCEL_ENV=preview`): kalau `APP_BASE_URL`
 *   kosong, boleh fallback ke `https://${VERCEL_URL}` (`VERCEL_URL` adalah
 *   environment variable bawaan Vercel, bukan dari header request).
 * - Production wajib `https` (URL ini dicetak sebagai QR permanen); `http`
 *   ditolak dengan error yang jelas.
 */

const DEV_DEFAULT_APP_BASE_URL = "http://localhost:3000";

/**
 * Menentukan nilai `APP_BASE_URL` sebelum divalidasi bentuk URL-nya oleh
 * Zod. Dipisah dari skema karena aturannya bergantung pada variabel lain
 * (`NODE_ENV`, `VERCEL_ENV`, `VERCEL_URL`), bukan sekadar default statis.
 */
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

  /** Base URL publik aplikasi, dipakai untuk tautan & QR (bukan dari header request). */
  APP_BASE_URL: z.string().url(),

  /** Connection string Prisma ke Supabase Postgres (dipasang di T-005). */
  DATABASE_URL: z.string().min(1).optional(),

  /** Header rahasia untuk endpoint cron (`Authorization: Bearer ...`). */
  CRON_SECRET: z.string().min(1).optional(),

  /** Konfigurasi Supabase (dipasang di T-004). URL & anon key aman untuk browser. */
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
});

function loadEnv() {
  const appBaseUrl = resolveAppBaseUrl();

  const parsed = envSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    APP_BASE_URL: appBaseUrl,
    DATABASE_URL: process.env.DATABASE_URL,
    CRON_SECRET: process.env.CRON_SECRET,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
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
