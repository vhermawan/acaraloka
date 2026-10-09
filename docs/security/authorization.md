# Checklist otorisasi per action

Dokumen ini mencatat guard yang dipakai setiap server action, route handler, dan halaman terlindungi, cek tambahan di baliknya, dan test yang membuktikannya. Test `tests/lib/authorization-inventory.test.ts` memastikan setiap berkas action, route, dan halaman terlindungi di `src/app` tercantum di sini. Saat menambah action, route, atau halaman baru, tambahkan barisnya di sini.

## Guard

Semua guard ada di `src/server/authz.ts`.

| Guard | Arti | Kalau gagal |
| --- | --- | --- |
| `requireUser` | Sesi ada, akun tidak dinonaktifkan, syarat dan ketentuan versi terbaru sudah disetujui | redirect ke login, `?error=disabled`, atau `/legal/accept` |
| `requireParticipant` | `requireUser` + peran PARTICIPANT | akun panitia diarahkan ke `/organizer`, akun admin ke `/admin` |
| `requireOrganizer` | `requireUser` (login panitia) + peran ORGANIZER + `OrganizerProfile` ada | peserta ke `/organizer/login?error=role-participant`, admin ke `/organizer/login?error=role-admin` (pesan generik), tanpa profil ke `/organizer/register` |
| `requireEventOwner(eventId)` | `requireOrganizer` + `event.organizerId === user.id` | `notFound()` (event orang lain tidak bisa dibedakan dari event yang tidak ada) |
| `requireAdmin` | sesi dengan peran ADMIN, lalu `requireUser` (akun aktif, syarat disetujui). Peran dicek lebih dulu, jadi peserta dan panitia selalu mendapat 404 tanpa redirect apa pun | peserta/panitia: `notFound()`; tanpa sesi: redirect `/admin/login`; admin dinonaktifkan: `/admin/login?error=disabled` |
| Token | Token penandatangan di URL, hanya hash yang disimpan, ada masa berlaku dan sekali pakai | pesan "tautan tidak berlaku" atau 404 |
| `CRON_SECRET` | Header `Authorization: Bearer <secret>`, dibandingkan dengan `timingSafeEqual` | 401, tanpa menjalankan pekerjaan |
| Publik | Tanpa login, hanya data yang memang boleh dilihat umum | - |

Lapisan tambahan: `src/proxy.ts` mengarahkan permintaan tanpa cookie sesi di `/me` ke `/login`, `/organizer` ke `/organizer/login`, dan `/admin` ke `/admin/login` (kecuali `/admin/login` sendiri). Itu hanya pagar kasar. Otorisasi sebenarnya selalu dicek ulang oleh guard di server. `src/app/organizer/layout.tsx` dan `src/app/admin/layout.tsx` hanya merender shell dan tidak menjadi guard.

## Aturan IDOR

Setiap action yang menerima id (`eventId`, `registrationId`, `signerId`, `certificateId`, `ticketTypeId`, `fieldId`) harus:

1. memanggil `requireEventOwner(eventId)` lebih dulu (organizer), atau memfilter `userId` sesi pada query (peserta);
2. menyertakan `eventId` hasil guard (bukan input mentah) di klausa `where` untuk setiap id anak.

Test lintas-event ada di `tests/integration/authorization-idor.test.ts`: organizer A memanggil action dengan `eventId` miliknya tetapi id anak milik event B, dan data event B harus tetap utuh.

## Server action

Singkatan kolom test (berlaku untuk semua tabel): A = `tests/server/action-authorization.test.ts` (tanpa sesi, akun dinonaktifkan, peran salah, bukan pemilik event, event tutup, memakai guard asli dan memastikan tidak ada efek samping), I = `tests/integration/authorization-idor.test.ts`, B = `tests/server/token-and-route-authorization.test.ts`, F = `tests/integration/critical-flow.test.ts` (jalur utama).

| No | Action | Berkas | Guard | Cek tambahan | Test |
| --- | --- | --- | --- | --- | --- |
| 1 | `createEvent` | `src/app/organizer/events/actions.ts` | `requireOrganizer` | `organizerId` diisi dari sesi, bukan input | A |
| 2 | `updateEvent` | `src/app/organizer/events/actions.ts` | `requireEventOwner` | status DRAFT/PUBLISHED saja | A, `tests/server/event-actions.test.ts` |
| 3 | `deleteEvent` | `src/app/organizer/events/actions.ts` | `requireEventOwner` | status DRAFT saja | A, I, `tests/server/event-actions.test.ts` |
| 4 | `createPosterUpload` | `src/app/organizer/events/actions.ts` | `requireEventOwner` | status DRAFT/PUBLISHED, path di bawah `events/<id>/` | A, `tests/server/event-actions.test.ts` |
| 5 | `setEventPoster` | `src/app/organizer/events/actions.ts` | `requireEventOwner` | status DRAFT/PUBLISHED, path harus di `events/<id>/` tanpa `..` | A, `tests/server/event-actions.test.ts` |
| 6 | `publishEvent` | `src/app/organizer/events/actions.ts` | `requireEventOwner` | update hanya bila status masih DRAFT | A, I |
| 7 | `cancelEventAction` | `src/app/organizer/events/actions.ts` | `requireEventOwner` | hanya PUBLISHED sebelum mulai; judul harus diketik ulang | A, `tests/integration/cancellation.test.ts` |
| 8 | `createTicketType` | `src/app/organizer/events/[id]/tickets/actions.ts` | `requireEventOwner` | status DRAFT/PUBLISHED; `eventId` dari guard | A |
| 9 | `updateTicketType` | `src/app/organizer/events/[id]/tickets/actions.ts` | `requireEventOwner` | status DRAFT/PUBLISHED; tiket dicari dengan `{id, eventId}` | A, I |
| 10 | `deleteTicketType` | `src/app/organizer/events/[id]/tickets/actions.ts` | `requireEventOwner` | status DRAFT/PUBLISHED; hitung pendaftar dan hapus dibatasi `eventId` | A, I |
| 11 | `createFormField` | `src/app/organizer/events/[id]/form/actions.ts` | `requireEventOwner` | status DRAFT/PUBLISHED | A |
| 12 | `updateFormField` | `src/app/organizer/events/[id]/form/actions.ts` | `requireEventOwner` | status DRAFT/PUBLISHED; `updateMany` dengan `{id, eventId}` | A, I |
| 13 | `deleteFormField` | `src/app/organizer/events/[id]/form/actions.ts` | `requireEventOwner` | status DRAFT/PUBLISHED; `deleteMany` dengan `{id, eventId}` | A, I |
| 14 | `moveFormField` | `src/app/organizer/events/[id]/form/actions.ts` | `requireEventOwner` | status DRAFT/PUBLISHED; urutan hanya dari field milik event | A, I |
| 15 | `cancelParticipant` | `src/app/organizer/events/[id]/participants/actions.ts` | `requireEventOwner` | tolak bila DISABLED; pendaftaran dicari dengan `{id, eventId}` | A, I, `tests/integration/cancellation.test.ts` |
| 16 | `checkInByCode` | `src/app/organizer/events/[id]/checkin/actions.ts` | `requireEventOwner` | hanya event PUBLISHED; kode milik event lain dijawab WRONG_EVENT tanpa data peserta | A, I, F, `tests/integration/checkin.test.ts` |
| 17 | `checkInByRegistration` | `src/app/organizer/events/[id]/checkin/actions.ts` | `requireEventOwner` | hanya event PUBLISHED; `updateMany` dengan `eventId` | A, I, `tests/integration/checkin.test.ts` |
| 18 | `undoParticipantCheckIn` | `src/app/organizer/events/[id]/checkin/actions.ts` | `requireEventOwner` | tolak bila DISABLED atau sertifikat sudah terbit; `{id, eventId}` | A, I, `tests/integration/checkin.test.ts` |
| 19 | `searchParticipants` | `src/app/organizer/events/[id]/checkin/actions.ts` | `requireEventOwner` | baca saja; query dibatasi `eventId`, hanya CONFIRMED | A, I |
| 20 | `saveLayout` | `src/app/organizer/events/[id]/certificate/actions.ts` | `requireEventOwner` | tolak bila DISABLED; tolak bila desain terkunci | A, `tests/integration/certificate-config.test.ts` |
| 21 | `createSigner` | `src/app/organizer/events/[id]/certificate/actions.ts` | `requireEventOwner` | tolak bila CANCELLED/DISABLED; maksimal 3; tolak bila terkunci | A, F, `tests/integration/signers.test.ts` |
| 22 | `regenerateLink` | `src/app/organizer/events/[id]/certificate/actions.ts` | `requireEventOwner` | tolak bila CANCELLED/DISABLED; `{id, eventId}`, bukan yang sudah SIGNED | A, I, `tests/integration/signers.test.ts` |
| 23 | `emailSignerLink` | `src/app/organizer/events/[id]/certificate/actions.ts` | `requireEventOwner` | tolak bila CANCELLED/DISABLED atau email nonaktif; `{id, eventId}` | A |
| 24 | `deleteSigner` | `src/app/organizer/events/[id]/certificate/actions.ts` | `requireEventOwner` | tolak bila DISABLED; tolak bila terkunci/SIGNED; `{id, eventId}` | A, I, `tests/integration/signers.test.ts` |
| 25 | `unlockDesign` | `src/app/organizer/events/[id]/certificate/actions.ts` | `requireEventOwner` | tolak bila DISABLED; tolak setelah sertifikat terbit | A, `tests/integration/signers.test.ts`, `tests/integration/certificates.test.ts` |
| 26 | `issueEventCertificates` | `src/app/organizer/events/[id]/certificate/actions.ts` | `requireEventOwner` | blocker CLOSED untuk CANCELLED/DISABLED; harus sudah mulai, terkunci, semua TTD | A, I, F, `tests/integration/certificates.test.ts`, `tests/integration/admin-events.test.ts` |
| 27 | `revokeEventCertificate` | `src/app/organizer/events/[id]/certificate/actions.ts` | `requireEventOwner` | `{id, eventId}`; alasan wajib. Sengaja tetap boleh pada event DISABLED/CANCELLED karena pencabutan adalah tindakan koreksi | A, I, F, `tests/server/certificate-revoke-action.test.ts`, `tests/integration/certificates.test.ts` |
| 28 | `registerOrganizer` | `src/app/organizer/register/actions.ts` | `requireUser` (login panitia) | peran harus ORGANIZER (peserta dan admin ditolak); profil di-upsert untuk `user.id` sesi | A |
| 29 | `disableEventAction` | `src/app/admin/events/actions.ts` | `requireAdmin` | tolak bila sudah DISABLED; audit log | A, `tests/server/admin-events-actions.test.ts`, `tests/integration/admin-events.test.ts` |
| 30 | `enableEventAction` | `src/app/admin/events/actions.ts` | `requireAdmin` | hanya bila DISABLED; audit log | A, `tests/server/admin-events-actions.test.ts`, `tests/integration/admin-events.test.ts` |
| 30a | `disableUserAction` | `src/app/admin/users/actions.ts` | `requireAdmin` | alasan wajib; tolak akun sendiri dan akun ADMIN (dicek di server, di dalam transaksi); tolak bila sudah nonaktif; `disabledAt`, hapus semua sesi, dan audit log dalam satu transaksi | A, `tests/server/admin-users-actions.test.ts`, `tests/integration/admin-users.test.ts` |
| 30b | `enableUserAction` | `src/app/admin/users/actions.ts` | `requireAdmin` | hanya bila sedang nonaktif; audit log | A, `tests/server/admin-users-actions.test.ts`, `tests/integration/admin-users.test.ts` |
| 31 | `cancelMyRegistration` | `src/app/me/tickets/[id]/actions.ts` | `requireParticipant` | pendaftaran dicari dengan `{id, userId}`; event PUBLISHED dan belum selesai; belum check-in | A, I, `tests/integration/cancellation.test.ts` |
| 32 | `renameMyRegistration` | `src/app/me/tickets/[id]/actions.ts` | `requireParticipant` | `{id, userId}`; tolak setelah sertifikat terbit | A, I, `tests/integration/certificates.test.ts` |
| 33 | `acceptTerms` | `src/app/legal/accept/actions.ts` | sesi saja (`getSession`) | hanya mengubah baris `user.id` sesi; tujuan redirect lewat `safeRedirectPath` | A, `tests/lib/safe-redirect.test.ts` |
| 34 | `registerForEvent` | `src/app/e/[slug]/register/actions.ts` | `requireUser` | hanya akun PARTICIPANT (ORGANIZER dan ADMIN ditolak); email harus terverifikasi; event PUBLISHED dan belum selesai; tiket harus milik event; satu pendaftaran aktif per akun | A, F, `tests/server/register-action.test.ts`, `tests/integration/registration.test.ts` |
| 35 | `submitSignature` | `src/app/sign/[token]/actions.ts` | Token | tautan aktif (belum kedaluwarsa, belum dipakai, PENDING), event bukan CANCELLED/DISABLED; persetujuan wajib; PNG divalidasi | B, F, `tests/integration/signers.test.ts` |
| 36 | `declineSigning` | `src/app/sign/[token]/actions.ts` | Token | sama seperti di atas; alasan wajib | B, `tests/integration/signers.test.ts` |

## Route handler

| No | Route | Berkas | Guard | Cek tambahan | Test |
| --- | --- | --- | --- | --- | --- |
| 1 | `GET /api/cron/daily` | `src/app/api/cron/daily/route.ts` | `CRON_SECRET` | 401 bila secret kosong atau header salah | B, `tests/lib/cron-auth.test.ts` |
| 2 | `GET /me/certificates/[number]/pdf` | `src/app/me/certificates/[number]/pdf/route.ts` | sesi + peran PARTICIPANT + akun aktif | sertifikat dicari dengan `{number, registration.userId}` dan belum dicabut; tetap bisa diunduh setelah event DISABLED | F, `tests/server/certificate-download-route.test.ts`, `tests/integration/certificates.test.ts` |
| 3 | `GET /organizer/events/[id]/certificate/preview` | `src/app/organizer/events/[id]/certificate/preview/route.ts` | `requireEventOwner` | PDF contoh bertanda air PRATINJAU, tanpa data peserta | B |
| 4 | `GET /sign/[token]/preview` | `src/app/sign/[token]/preview/route.ts` | Token | `canSign` (aktif dan event tidak tutup), selain itu 404; data contoh saja | B |
| 5 | `GET /auth/continue` | `src/app/auth/continue/route.ts` | sesi Better Auth | akun dinonaktifkan dan konflik peran di-sign-out (admin di `/login` atau `/organizer/login` mendapat pesan generik; non-admin di `/admin/login` mendapat "Akun ini tidak punya akses admin."); tujuan lewat `resolvePostLoginPath` (admin hanya ke `/admin/*`); tidak mengubah data | `tests/server/auth-continue.test.ts` |
| 6 | `GET, POST /api/auth/[...all]` | `src/app/api/auth/[...all]/route.ts` | Better Auth (publik, dibatasi rate limit) | field user milik server `input: false`; peran dari halaman pendaftaran; intent ADMIN ditolak 403 untuk `/sign-up/email` dan akun baru OAuth, peran ADMIN hanya dari backfill/seed/DB | `tests/integration/email-password-auth.test.ts`, `tests/server/new-user.test.ts`, `tests/lib/auth-config.test.ts` |

## Halaman

### Terlindungi

| No | Halaman | Berkas | Guard | Cek tambahan | Test |
| --- | --- | --- | --- | --- | --- |
| 1 | `/me/tickets` | `src/app/me/tickets/page.tsx` | `requireParticipant` | daftar dibatasi `userId` sesi | `tests/server/authz.test.ts`, `tests/lib/authorization-inventory.test.ts` |
| 2 | `/me/tickets/[id]` | `src/app/me/tickets/[id]/page.tsx` | `requireParticipant` | `getUserTicket` memakai `{id, userId}`, selain itu 404; QR hanya untuk tiket aktif | `tests/integration/critical-flow.test.ts`, `tests/lib/authorization-inventory.test.ts` |
| 3 | `/me/certificates` | `src/app/me/certificates/page.tsx` | `requireParticipant` | daftar dibatasi `registration.userId` | `tests/integration/certificates.test.ts`, `tests/lib/authorization-inventory.test.ts` |
| 4 | `/organizer` | `src/app/organizer/page.tsx` | `requireOrganizer` | daftar acara dibatasi `organizerId` sesi | `tests/server/route-guards.test.ts`, `tests/lib/authorization-inventory.test.ts` |
| 5 | `/organizer/events/new` | `src/app/organizer/events/new/page.tsx` | `requireOrganizer` | - | `tests/server/authz.test.ts`, `tests/lib/authorization-inventory.test.ts` |
| 6 | `/organizer/events/[id]` | `src/app/organizer/events/[id]/page.tsx` | `requireEventOwner` | - | `tests/server/authz.test.ts`, `tests/lib/authorization-inventory.test.ts` |
| 7 | `/organizer/events/[id]/tickets` | `src/app/organizer/events/[id]/tickets/page.tsx` | `requireEventOwner` | data dibatasi `event.id` hasil guard | `tests/server/authz.test.ts`, `tests/lib/authorization-inventory.test.ts` |
| 8 | `/organizer/events/[id]/form` | `src/app/organizer/events/[id]/form/page.tsx` | `requireEventOwner` | data dibatasi `event.id` hasil guard | `tests/server/authz.test.ts`, `tests/lib/authorization-inventory.test.ts` |
| 9 | `/organizer/events/[id]/participants` | `src/app/organizer/events/[id]/participants/page.tsx` | `requireEventOwner` | data dibatasi `event.id` hasil guard | `tests/server/authz.test.ts`, `tests/lib/authorization-inventory.test.ts` |
| 10 | `/organizer/events/[id]/checkin` | `src/app/organizer/events/[id]/checkin/page.tsx` | `requireEventOwner` | - | `tests/server/authz.test.ts`, `tests/lib/authorization-inventory.test.ts` |
| 11 | `/organizer/events/[id]/certificate` | `src/app/organizer/events/[id]/certificate/page.tsx` | `requireEventOwner` | penandatangan dibatasi `event.id` hasil guard | `tests/server/authz.test.ts`, `tests/lib/authorization-inventory.test.ts` |
| 12 | `/admin` | `src/app/admin/page.tsx` | `requireAdmin` | - | `tests/server/authz.test.ts`, `tests/server/route-guards.test.ts`, `tests/lib/authorization-inventory.test.ts` |
| 13 | `/admin/events` | `src/app/admin/events/page.tsx` | `requireAdmin` | - | `tests/server/authz.test.ts`, `tests/lib/authorization-inventory.test.ts` |
| 13a | `/admin/users` | `src/app/admin/users/page.tsx` | `requireAdmin` | pencarian, filter, dan halaman dibaca dari `searchParams` dan divalidasi; query memilih kolom terbatas (tanpa token atau hash password) | `tests/server/admin-users-actions.test.ts`, `tests/lib/authorization-inventory.test.ts` |
| 13b | `/admin/users/[id]` | `src/app/admin/users/[id]/page.tsx` | `requireAdmin` | sesi hanya menampilkan waktu, user agent, dan IP (tanpa token); tombol nonaktifkan disembunyikan untuk diri sendiri dan admin, tetapi penolakan sebenarnya ada di server | `tests/server/admin-users-actions.test.ts`, `tests/lib/authorization-inventory.test.ts` |
| 14 | `/admin/logs` | `src/app/admin/logs/page.tsx` | `requireAdmin` | - | `tests/server/authz.test.ts`, `tests/lib/authorization-inventory.test.ts` |
| 15 | `/admin/test-error` | `src/app/admin/test-error/page.tsx` | `requireAdmin` | melempar galat sengaja hanya setelah guard lolos | `tests/server/authz.test.ts`, `tests/lib/authorization-inventory.test.ts` |
| 16 | `/e/[slug]/register` | `src/app/e/[slug]/register/page.tsx` | `requireUser` | event publik PUBLISHED dan belum selesai; akun ORGANIZER melihat pesan penolakan | `tests/server/register-action.test.ts`, `tests/lib/authorization-inventory.test.ts` |

### Token

| No | Halaman | Berkas | Guard | Cek tambahan | Test |
| --- | --- | --- | --- | --- | --- |
| 1 | `/sign/[token]` | `src/app/sign/[token]/page.tsx` | Token | tampil sesuai status tautan (tidak berlaku, event ditutup, sudah TTD, ditolak, kedaluwarsa) | `tests/integration/signers.test.ts` |

### Publik

| No | Halaman | Berkas | Cek | Test |
| --- | --- | --- | --- | --- |
| 1 | `/e/[slug]` | `src/app/e/[slug]/page.tsx` | `getPublicEvent` hanya mengembalikan PUBLISHED dan CANCELLED; DISABLED dan DRAFT 404 | `tests/integration/admin-events.test.ts` |
| 2 | `/v/[number]` | `src/app/v/[number]/page.tsx` | hanya field publik; nomor tidak dikenal 404 | `tests/integration/critical-flow.test.ts`, `tests/integration/certificates.test.ts` |
| 3 | `/` | `src/app/page.tsx` | statis | - |
| 4 | `/login` | `src/app/login/page.tsx` | redirect bila sudah login | - |
| 5 | `/register` | `src/app/register/page.tsx` | redirect bila sudah login | - |
| 6 | `/organizer/login` | `src/app/organizer/login/page.tsx` | dikecualikan dari `src/proxy.ts`; redirect bila sudah login | - |
| 6a | `/admin/login` | `src/app/admin/login/page.tsx` | dikecualikan dari `src/proxy.ts`; redirect ke `/admin` bila sudah login sebagai ADMIN; tanpa tautan daftar, login tidak pernah membuat akun | `tests/server/proxy.test.ts`, `tests/server/auth-continue.test.ts`, `tests/server/new-user.test.ts` |
| 7 | `/organizer/register` | `src/app/organizer/register/page.tsx` | `requireUser` (login panitia); dikecualikan dari `src/proxy.ts` agar akun baru bisa melengkapi profil | `tests/lib/authorization-inventory.test.ts` |
| 8 | `/legal/accept` | `src/app/legal/accept/page.tsx` | sesi saja | `tests/lib/authorization-inventory.test.ts` |
| 9 | `/legal/terms` | `src/app/legal/terms/page.tsx` | statis | - |
| 10 | `/legal/privacy` | `src/app/legal/privacy/page.tsx` | statis | - |
| 11 | `/check-email` | `src/app/check-email/page.tsx` | statis | - |
| 12 | `/forgot-password` | `src/app/forgot-password/page.tsx` | formulir publik, jawaban sama untuk email dikenal dan tidak | `tests/integration/email-password-auth.test.ts` |
| 13 | `/reset-password` | `src/app/reset-password/page.tsx` | token reset Better Auth | `tests/integration/email-password-auth.test.ts` |

## Catatan keputusan

- Route unduh PDF `/me/certificates/[number]/pdf` memakai `getSession` langsung, bukan `requireParticipant`, karena guard itu mengarahkan ke halaman (redirect) yang tidak cocok untuk respons berkas. Akibatnya versi Syarat & Privasi terbaru tidak dicek saat mengunduh. Ini disengaja: sertifikat yang sudah terbit tetap hak pemiliknya, dan datanya dibatasi `registration.userId` dari sesi.
- `tests/lib/authorization-inventory.test.ts` mem-parse berkas dengan TypeScript AST: setiap fungsi yang diekspor dari berkas `"use server"` wajib punya baris sendiri (nama + berkas), setiap export HTTP method di `route.ts` wajib tercantum, dan action yang guard-nya `require*` harus memanggil guard itu sebagai `await` pertama.
- `revokeEventCertificate` sengaja tidak diblok pada event DISABLED/CANCELLED. Pencabutan sertifikat adalah koreksi, bukan penerbitan. Bila ingin admin membekukan penuh event DISABLED, tambahkan cek status di action dan satu baris di test A.
- Event CANCELLED masih boleh `deleteSigner` dan `unlockDesign` (hanya DISABLED yang ditolak); `createSigner`, `regenerateLink`, `emailSignerLink`, dan penerbitan ditolak untuk keduanya.
- Penandatangan memakai token sekali pakai di URL tanpa login. Yang membatasi risikonya: hash token di DB, masa berlaku, status PENDING, `Referrer-Policy: no-referrer`, dan event tidak boleh tutup.
- Peran ADMIN adalah akun terpisah dari peserta dan panitia (`User.role`). Kolom `isAdmin` dihapus; peran ADMIN hanya berasal dari backfill migrasi, `prisma/seed.ts`, atau DB langsung. Intent ADMIN ditolak (403) oleh hook `hooks.before` untuk `/sign-up/email` dan oleh `databaseHooks.user.create.before` (`src/server/new-user.ts`) untuk akun baru lewat OAuth, sehingga `/admin/login` tidak pernah membuat akun. Akun ADMIN ditolak di `/me/*`, `/organizer/*`, dan pendaftaran acara; peserta dan panitia mendapat 404 di `/admin/*`.
- Menonaktifkan pengguna (`disableUser` di `src/server/admin-users.ts`) mengisi `User.disabledAt`, menghapus semua baris `session` pengguna, dan menulis `AuditLog` (`user.disabled`, alasan di `meta`) dalam satu transaksi. Akun sendiri dan akun ADMIN ditolak di server. Mengaktifkan kembali menulis `user.enabled`. Alasan disimpan di audit log, bukan di kolom `User`.
- Akun nonaktif ditolak berlapis: `requireUser` (redirect `?error=disabled`), `GET /auth/continue` (sign-out), dan hook `databaseHooks.session.create.before` (`src/server/session-guard.ts`) yang menolak `POST /sign-in/email` dengan 403 `ACCOUNT_DISABLED` sehingga sesi tidak pernah dibuat. Jalur OAuth dan verifikasi email tidak diblok di hook (agar redirect Better Auth tidak rusak) dan mengandalkan dua lapis pertama. Test: `tests/integration/admin-users.test.ts`, `tests/server/session-guard.test.ts`.
