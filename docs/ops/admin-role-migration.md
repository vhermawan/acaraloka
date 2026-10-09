# Migrasi peran ADMIN (T-036)

Peran admin kini disimpan di `"user"."role"` (`ADMIN`). Kolom lama `"isAdmin"` tetap ada di database tetapi tidak dibaca atau ditulis oleh kode. Kolom itu baru dihapus di rilis berikutnya (fase contract).

## Migrasi rilis ini

1. `20261009160000_user_role_admin`: menambah nilai `ADMIN` ke enum `UserRole`.
2. `20261009160100_admin_role_backfill`: `UPDATE "user" SET "role" = 'ADMIN' WHERE "isAdmin" = true`. Tidak ada `DROP`.

Tidak ada data yang dihapus. Menjalankan ulang backfill aman (idempoten).

## Cek sebelum migrasi prod (baca saja)

Akun admin sekarang bisa saja memiliki profil panitia, acara, atau pendaftaran. Setelah menjadi ADMIN, data itu tetap ada tetapi tidak terlihat di UI peserta atau panitia.

```sql
SELECT
  u.id,
  u.email,
  (SELECT count(*) FROM organizer_profiles p WHERE p.user_id = u.id) AS profil_panitia,
  (SELECT count(*) FROM events e WHERE e.organizer_id = u.id) AS acara,
  (SELECT count(*) FROM registrations r WHERE r.user_id = u.id) AS pendaftaran
FROM "user" u
WHERE u."isAdmin" = true;
```

Jika semua hitungan 0, tidak ada tindakan lain. Jika `acara` atau `pendaftaran` lebih dari 0, putuskan sebelum atau sesudah migrasi apa yang dilakukan (lihat di bawah). Kedua kondisi aman untuk menjalankan migrasi.

## Urutan rilis

Kedua urutan aman, karena kolom `"isAdmin"` tidak dihapus:

- Migrasi dulu, lalu deploy: kode lama tetap bisa membaca `"isAdmin"`. Satu-satunya efek, akun yang sudah ber-role `ADMIN` bisa gagal dibaca oleh client Prisma lama (enum tidak dikenal) selama jeda deploy. Akun peserta dan panitia tidak terpengaruh.
- Deploy dulu, lalu migrasi: kode baru tidak memakai `"isAdmin"`. Sebelum backfill berjalan, belum ada akun ADMIN, jadi `/admin` memberi 404 untuk semua orang sampai migrasi selesai.

Langkah yang disarankan:

1. Jalankan SQL cek di atas.
2. Terapkan migrasi dan deploy rilis ini.
3. Verifikasi: login admin di `/admin/login`, `/admin` terbuka, peserta dan panitia mendapat 404 di `/admin`, admin ditolak di `/login` dan `/organizer/login`.
4. Rilis berikutnya (contract): migrasi `ALTER TABLE "user" DROP COLUMN "isAdmin"` dan hapus field dari `schema.prisma`. Dikerjakan sebagai todo terpisah, setelah langkah 3 terverifikasi.

## Jika admin punya acara

Pindahkan kepemilikan ke akun panitia biasa yang sudah punya profil panitia. Ganti `<id-admin>` dan `<id-panitia>` dengan nilai `id` dari hasil SQL cek.

```sql
BEGIN;

SELECT count(*) FROM organizer_profiles WHERE user_id = '<id-panitia>';

UPDATE events
SET organizer_id = '<id-panitia>'
WHERE organizer_id = '<id-admin>';

COMMIT;
```

Pastikan hasil `SELECT` pertama adalah 1; jika 0, `ROLLBACK` dan buat profil panitia untuk akun tujuan lebih dulu (kolom `events.organizer_id` memiliki foreign key ke `organizer_profiles.user_id`). Pendaftaran milik admin sebagai peserta tidak perlu dipindahkan; tiket tetap tersimpan di akun itu.
