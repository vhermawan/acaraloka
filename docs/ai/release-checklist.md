# Checklist rilis beta AI

Fitur AI dirilis tertutup: flag mati secara default, lalu dinyalakan bertahap lewat allowlist panitia.

## Sebelum deploy

- [ ] Migrasi AI sudah diterapkan ke database produksi (`pnpm db:migrate`) dan `pnpm db:generate` dijalankan di build.
- [ ] Bucket privat `ai-generations` sudah dibuat (B-008, `pnpm storage:setup`) dan tidak publik.
- [ ] Env produksi terisi (nama saja, nilai diisi pemilik): `AI_ENABLED`, `AI_MONTHLY_CAP_USD`, `AI_TRIAL_CAP_USD`, `AI_TRIAL_ENDS_ON`, `AI_GLOBAL_DAILY_LIMIT`, `AI_GENERATION_DEADLINE_MS`, `AI_IMAGE_PROVIDER`, `AI_TEXT_PROVIDER`, `GOOGLE_VERTEX_PROJECT`, `GOOGLE_VERTEX_LOCATION`, `GOOGLE_VERTEX_SA_KEY_B64`, `VERTEX_IMAGE_MODEL`, `VERTEX_TEXT_MODEL`.
- [ ] `AI_ENABLED=false` saat deploy pertama. Preview deployment juga `false`.
- [ ] Budget alert Google Cloud sudah dipasang (B-006), nilainya sejalan dengan cap aplikasi.
- [ ] Klausul pemrosesan oleh vendor AI sudah masuk Kebijakan Privasi dan Syarat (B-009).
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, dan `pnpm test:integration` lolos pada commit yang dirilis.

## Urutan menyalakan

1. Deploy dengan `AI_ENABLED=false`. Pastikan `/admin/ai` terbuka dan menampilkan "Nonaktif (konfigurasi)".
2. Tambahkan satu akun panitia uji ke allowlist lewat `/admin/ai` (kartu AI belum muncul karena flag masih mati).
3. Set `AI_ENABLED=true` dan redeploy. Status di `/admin/ai` berubah menjadi "Aktif".
4. Uji dari akun panitia uji: buat desain, pratinjau, pakai, lapor, hapus logo.
5. Periksa biaya di `/admin/ai` dan di Google Cloud billing; harus sejalan.
6. Tambahkan panitia beta lain satu per satu lewat allowlist.
7. Pantau `/admin/ai` dan jalankan query di `docs/ai/metrics.sql` secara berkala (tingkat dipakai, error per kode, biaya).

## Rollback

- Set `AI_ENABLED=false` dan redeploy. Kartu AI hilang, semua route AI menjawab "Fitur AI sedang tidak tersedia.", dan `/admin/ai` tetap bisa dibuka.
- Desain yang sudah dipakai tetap utuh karena latarnya sudah disalin ke `certificate-backgrounds`.
- Mengeluarkan satu akun saja: hapus dari allowlist di `/admin/ai`.
