# 01. Brand Hadirly

## Nama

- Tulisan: **Hadirly** (H kapital, sisanya kecil). Jangan "HadirLy" atau "HADIRLY" di teks berjalan.
- Asal kata: "hadir". Inti produk memang soal kehadiran: siapa yang hadir dapat sertifikat.
- Wordmark: teks "Hadirly" dengan Plus Jakarta Sans 700. Ikon opsional: tanda centang yang menyatu dengan huruf "H" atau titik QR kecil. Jangan pakai ikon kalender generik.

## Satu kalimat posisi

Hadirly membantu panitia seminar, workshop, dan meetup mengurus pendaftaran, e-tiket QR, check-in, dan sertifikat bertanda tangan dalam satu tempat.

## Untuk siapa

| Pengguna | Kebutuhan utama | Bahasa yang dipakai |
|---|---|---|
| Panitia (HIMA, komunitas, trainer workshop) | Absensi cepat, sertifikat tanpa kerja manual | "peserta", "acara", "panitia" |
| Peserta (mahasiswa, profesional muda) | Daftar dari HP, dapat sertifikat untuk portofolio/SKP | "tiket saya", "sertifikat saya" |
| Penandatangan (ketua, dosen, narasumber) | Tanda tangan dari HP kurang dari 2 menit, tanpa bikin akun | "tanda tangani", "setujui" |

## Nada bahasa

- Bahasa Indonesia santai-sopan, pakai "kamu". Sama seperti teks yang sudah ada di aplikasi.
- Kalimat pendek, kata kerja jelas: "Buat acara", "Scan tiket", "Terbitkan sertifikat".
- Hindari: "solusi terdepan", "revolusioner", "seamless", "tingkatkan pengalaman", "all-in-one platform terbaik".
- Tanpa tanda pisah panjang (em dash) di copy.
- Boleh menyebut masalah nyata: Google Form, absen kertas, sertifikat diketik satu per satu di Canva.

## Warna

Diambil dari `src/app/globals.css` supaya desain cocok dengan aplikasi.

| Token | Light | Dark | Pakai untuk |
|---|---|---|---|
| `primary` | `#0F766E` (teal 700) | `#2DD4BF` (teal 400) | Tombol utama, link, fokus, aksen ikon |
| `primary-foreground` | `#FAFAFA` | `#252525` | Teks di atas primary |
| `background` | `#FFFFFF` | `#252525` | Latar halaman |
| `foreground` | `#252525` | `#FAFAFA` | Teks utama |
| `muted` | `#F7F7F7` | `#454545` | Latar section selang-seling, kartu sekunder |
| `muted-foreground` | `#8E8E8E` | `#B5B5B5` | Teks pendukung |
| `border` | `#EBEBEB` | `#FFFFFF1A` | Garis kartu, pemisah |

Warna status (badge dan layar hasil check-in):

| Status | Warna |
|---|---|
| Terkonfirmasi / VALID | hijau `#16A34A` |
| Sudah check-in | kuning `#CA8A04` |
| Dibatalkan / Tidak valid | merah `#DC2626` |
| Menunggu | abu `#737373` |

Aturan warna: teal dipakai hemat, maksimal satu blok besar berwarna teal per layar (misalnya section CTA penutup). Jangan gradien ungu-biru, jangan glow neon.

## Tipografi

- Sans: **Plus Jakarta Sans** (400, 500, 600, 700).
- Mono: **Geist Mono**, untuk nomor sertifikat dan kode tiket.
- Skala desktop: H1 56/64, H2 36/44, H3 22/30, body 16/26, kecil 14/22.
- Skala mobile: H1 36/44, H2 28/36, H3 20/28, body 16/26.
- Judul memakai tracking sedikit rapat (-1%), body normal.

## Bentuk dan ruang

- Radius dasar 8px (`0.5rem`). Kartu 12px, tombol 8px, badge penuh (pill).
- Grid desktop 12 kolom, lebar konten maks 1200px, gutter 24px. Mobile margin samping 16px.
- Jarak antar section desktop 120px, mobile 72px.
- Bayangan tipis saja (`0 1px 2px rgb(0 0 0 / 0.06)`), lebih banyak pakai border 1px.

## Gaya visual

- Foto: suasana acara kampus/komunitas Indonesia yang nyata (meja registrasi, peserta memegang HP, ruang seminar). Hindari foto stok kantor Barat.
- Ilustrasi utama justru UI produk: mockup HP layar scan QR, kartu e-tiket, dan sertifikat PDF. Produk adalah visualnya.
- Ikon: Lucide, stroke 1.5px, ukuran 20px. Konsisten dengan aplikasi.
- Hindari: blob abstrak, ikon 3D, emoji di judul, kartu fitur 3 kolom yang semuanya identik.
