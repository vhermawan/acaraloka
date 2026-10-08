# Brief desain Acaraloka

Kumpulan brief untuk mendesain landing page dan layar aplikasi Acaraloka di pen.dev. Baca berurutan; tiap file bisa ditempel ke pen.dev sebagai konteks.

| File | Isi |
|---|---|
| [01-brand.md](01-brand.md) | Nama, posisi produk, nada bahasa, warna, tipografi, aturan visual |
| [02-landing-page.md](02-landing-page.md) | Struktur landing page per section, lengkap dengan copy dan arahan layout |
| [03-components.md](03-components.md) | Komponen yang dipakai ulang: tombol, kartu, badge status, mockup sertifikat |
| [04-ai-certificate.md](04-ai-certificate.md) | Konsep fitur AI pembuat template sertifikat dan layar-layarnya |
| [05-pen-prompts.md](05-pen-prompts.md) | Prompt siap tempel untuk pen.dev, satu prompt per frame |
| [06-organizer-dashboard.md](06-organizer-dashboard.md) | Redesign dashboard panitia: shell, semua halaman `/organizer`, palet baru, prompt D0-D7 |

## Urutan kerja di pen.dev

1. Buat file `.pen` baru, tempel isi `01-brand.md` sebagai konteks gaya.
2. Buat variabel warna dan font dari tabel di `01-brand.md`.
3. Buat komponen dari `03-components.md` lebih dulu supaya section landing memakai komponen yang sama.
4. Jalankan prompt di `05-pen-prompts.md` satu per satu, mulai dari frame desktop 1440px, lalu versi mobile 390px.
5. Desain layar AI (`04-ai-certificate.md`) di halaman terpisah.

## Yang belum boleh muncul di desain

- Angka pengguna, jumlah event, atau testimoni. Acaraloka belum punya event nyata; pakai placeholder berlabel `[ISI: ...]` atau hapus section-nya.
- Logo klien atau mitra.
- Klaim "sertifikat sah secara hukum". Label resmi di halaman verifikasi adalah "Terverifikasi di Acaraloka".
- Fitur event berbayar dan AI template ditampilkan sebagai "Segera hadir", bukan fitur yang sudah ada.
