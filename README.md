# Acaraloka

Platform event untuk panitia di Indonesia: pendaftaran peserta, e-tiket QR, check-in pakai kamera HP, dan sertifikat PDF bertanda tangan yang bisa dicek keasliannya lewat QR.

Produksi: [acaraloka.com](https://acaraloka.com)

## Fitur

- **Peserta**: masuk dengan Google, daftar acara gratis, e-tiket QR di Tiket Saya, unduh sertifikat di Sertifikat Saya.
- **Panitia**: buat acara (poster, jenis tiket, kuota, formulir pendaftaran), terbitkan, kelola peserta, check-in lewat pemindai QR.
- **Sertifikat**: template bawaan dengan pilihan border, warna, dan font; penandatangan membubuhkan tanda tangan lewat tautan `/sign/[token]` tanpa login; penerbitan massal; verifikasi publik di `/v/[nomor]`; pencabutan per sertifikat.
- **Admin**: menonaktifkan dan mengaktifkan kembali acara, melihat log error.

## Stack

- Next.js 16 (App Router) + TypeScript, React 19
- Better Auth (Google OAuth) dengan adapter Prisma
- Prisma 7 + Postgres di Supabase; Supabase Storage untuk poster dan tanda tangan (server-side saja)
- shadcn/ui (Base UI) + Tailwind CSS 4
- pdf-lib + fontkit untuk PDF sertifikat
- Vitest untuk unit dan integration test
- Deploy di Vercel (region `sin1`), cron harian `/api/cron/daily`

## Menjalankan di lokal

Butuh Node.js dan pnpm.

1. Pasang dependency (sekaligus generate Prisma client):

   ```bash
   pnpm install
   ```

2. Salin `.env.example` ke `.env.local` lalu isi nilainya. Penjelasan tiap variabel ada di `.env.example`, validasinya di `src/lib/env.ts`.

3. Siapkan database dan storage:

   ```bash
   pnpm db:migrate
   pnpm storage:setup
   pnpm db:seed
   ```

   `db:seed` membuat akun admin dari `ADMIN_EMAIL`.

4. Jalankan dev server:

   ```bash
   pnpm dev
   ```

   Buka [http://localhost:3000](http://localhost:3000).

## Perintah

| Perintah | Fungsi |
| --- | --- |
| `pnpm dev` | Dev server |
| `pnpm build` | Build production (butuh `APP_BASE_URL` https) |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `next typegen` + `tsc --noEmit` |
| `pnpm test` | Unit test (Vitest) |
| `pnpm test:integration` | Integration test ke database dari `.env.local` |
| `pnpm db:migrate` | Jalankan migrasi Prisma |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:seed` | Seed akun admin |
| `pnpm storage:setup` | Buat bucket Supabase Storage |

## Struktur

```
src/app/          rute (publik, /me, /organizer, /admin, /sign, /v, /api)
src/components/   komponen UI per area
src/lib/          util murni dan konfigurasi (auth, env, format, brand)
src/server/       akses database dan otorisasi
prisma/           schema, migrasi, seed
assets/fonts/     font TTF untuk PDF sertifikat (lisensi OFL)
docs/design/      brief desain
tests/            unit dan integration test
```
