import { z } from "zod";

/**
 * Validasi terpusat untuk environment variable.
 *
 * Catatan penting:
 * - Modul ini hanya boleh diimpor dari kode server (Server Component,
 *   Server Action, Route Handler). Jangan diimpor dari Client Component.
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
 */

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  /** Base URL publik aplikasi, dipakai untuk tautan & QR (bukan dari header request). */
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),

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
  const parsed = envSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    APP_BASE_URL: process.env.APP_BASE_URL,
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

  return parsed.data;
}

export const env = loadEnv();
