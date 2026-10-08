# 06. Dashboard panitia

Brief redesign semua halaman panitia (`/organizer/*`). Tempel file ini ke pen.dev bersama `01-brand.md` dan `03-components.md`. Semua copy di bawah diambil dari aplikasi yang sudah jalan; jangan tambah fitur, angka, atau grafik yang tidak ada datanya.

## 0. Perubahan dari brand doc

Palet aksen pindah ke warna logo. Berlaku global (landing ikut).

| Token | Light | Dark | Catatan |
|---|---|---|---|
| `primary` | `#0F5257` | `#7CC7C4` | Teal tua logo. Dark mode: teal terang supaya kontras di `#252525` |
| `primary-foreground` | `#FFFFFF` | `#10202A` | |
| `accent-amber` | `#E9A23B` | `#E9A23B` | Aksen kecil saja: titik indikator, garis aktif tipis, highlight angka. Bukan tombol, bukan latar besar |
| `ink` | `#10202A` | - | Teks judul di latar terang (boleh menggantikan `#252525`) |
| `sidebar` | `#F7F8F8` | `#1E1E1E` | Latar sidebar, lebih kalem dari background |

Warna status tetap: hijau `#16A34A`, kuning `#CA8A04`, merah `#DC2626`, abu `#737373`.

## 1. Pengguna dan konteks

- Panitia HIMA, komunitas, trainer. Dipakai di laptop saat persiapan, dan di HP saat hari-H (check-in).
- Halaman check-in wajib nyaman di HP satu tangan. Halaman lain prioritas desktop, tetap rapi di 390px.
- Satu panitia biasanya punya 1 sampai 10 acara. Tidak perlu filter rumit.

## 2. Shell (layout bersama)

### Desktop 1280px

- **Sidebar kiri 248px**, latar `sidebar`, border kanan 1px.
  - Atas: logo `acaraloka-horizontal.svg` tinggi 28px.
  - Di bawah logo: nama penyelenggara (`orgName`, 14/600) + teks kecil "Panitia".
  - Tombol `default` lebar penuh: ikon `plus` + "Buat acara".
  - Menu: "Acara" (ikon `calendar`, aktif di `/organizer`).
  - Grup "Akun": "Tiket saya" (`ticket`), "Sertifikat saya" (`award`), "Admin" (`shield`, hanya bila admin).
  - Bawah: avatar inisial + nama + email (terpotong elipsis), menu titik tiga berisi "Keluar".
- **Area konten**: padding 32px, lebar maks 1040px.
- Item menu aktif: latar `primary` 8%, teks `primary`, garis kiri 2px `accent-amber`.

### Header acara (semua halaman `/organizer/events/[id]/*`)

- Breadcrumb: "Acara" / judul acara (terpotong).
- Baris judul: H1 24/700 judul acara + `EventStatusBadge` + di kanan tombol `outline sm` "Lihat halaman publik" (ikon `external-link`, hanya bila status Terbit).
- Baris meta 14px muted: tanggal + jam + zona (contoh "Sab, 12 Okt 2026 · 09.00 WIB") · lokasi.
- Tab bawah header (underline, garis aktif 2px `primary`): Detail, Tiket, Formulir, Peserta, Check-in, Sertifikat.

### Mobile 390px

- Topbar 56px: logo ikon + nama halaman + tombol menu (sheet dari kiri berisi isi sidebar).
- Tab acara jadi baris scroll horizontal, sticky di bawah topbar.
- Margin 16px, tap target min 44px.

### Badge status acara

| Status | Label | Gaya |
|---|---|---|
| DRAFT | Draf | outline abu |
| PUBLISHED | Terbit | hijau lembut (latar 10%, teks `#16A34A`) |
| CANCELLED | Dibatalkan | merah lembut |
| DISABLED | Dinonaktifkan | merah lembut |

### Banner acara dinonaktifkan

Muncul di bawah header bila DISABLED. Border merah 30%, latar merah 5%, ikon `alert-triangle`.
Judul "Acara ini dinonaktifkan admin", baris alasan, lalu: "Halaman publik, pendaftaran, check-in, dan penerbitan sertifikat ditutup. Sertifikat yang sudah terbit tetap berlaku. Hubungi admin di halo@acaraloka.com untuk mengaktifkan kembali."

## 3. Halaman

### 3.1 Daftar acara `/organizer`

- Header: teks kecil nama penyelenggara, H1 "Acara kamu", tombol "Buat acara" di kanan.
- Daftar acara sebagai **baris kartu** (bukan grid kartu identik): thumbnail poster 64x64 radius 8 (placeholder muted + ikon `image` bila kosong), judul 16/600, meta tanggal + jam + zona, badge status di kanan, chevron.
- Kelompokkan: "Akan datang" dan "Sudah lewat" (berdasarkan tanggal mulai). Draf ikut kelompok sesuai tanggal.
- Kosong: area dashed, ikon `calendar-plus`, "Belum ada acara", "Acara yang kamu buat akan muncul di sini.", tombol "Buat acara".
- Contoh data: "Workshop Desain UI Dasar" (Terbit, 12 Okt 2026 09.00 WIB), "Seminar Karier Data 2026" (Draf), "Meetup Komunitas Flutter Surabaya" (Terbit, sudah lewat).

### 3.2 Buat acara `/organizer/events/new`

- Lebar form maks 640px. H1 "Buat acara", sub "Acara disimpan sebagai draf. Poster, tiket, dan formulir bisa diatur setelahnya."
- Field: Judul acara; Deskripsi (textarea, placeholder "Jelaskan isi acara, pembicara, dan siapa yang cocok ikut."); Zona waktu (WIB/WITA/WIT); Mulai + Selesai (dua kolom); Lokasi (hint "Alamat tempat, atau tautan Zoom/Meet untuk acara online.").
- Tombol "Simpan draf" + ghost "Batal".
- Tunjukkan state error di salah satu field: "Waktu selesai harus setelah waktu mulai."

### 3.3 Detail acara `/organizer/events/[id]`

- **Panel terbit** (hanya Draf): kartu dengan border `primary` 30%. Judul "Terbitkan acara". Checklist syarat dengan ikon centang hijau / lingkaran abu, contoh: "Tambahkan minimal satu jenis tiket." belum terpenuhi, "Waktu mulai harus di masa depan." terpenuhi. Tombol "Terbitkan" (disabled bila ada syarat belum terpenuhi).
- Bila Terbit: baris "Halaman publik: /e/workshop-desain-ui-dasar" + tombol salin.
- Dua kolom: kiri "Detail acara" (form sama dengan 3.2, tombol "Simpan perubahan"), kanan 280px "Poster" (pratinjau rasio 4:5, "Belum ada poster", tombol "Unggah poster"/"Ganti poster", hint "JPG, PNG, atau WebP. Maksimal 2 MB.").
- Zona bahaya di bawah, dipisah garis: "Batalkan acara" (hanya Terbit & belum mulai; teks "Hanya bisa sebelum acara dimulai. Peserta tidak bisa check-in setelah acara dibatalkan.", tombol outline merah) atau "Hapus draf" (hanya Draf; "Hanya acara yang belum terbit yang bisa dihapus.").

### 3.4 Tiket `/organizer/events/[id]/tickets`

- Judul "Jenis tiket", sub "Semua tiket gratis. Kuota tidak bisa dikurangi di bawah jumlah yang sudah dipesan."
- Tiap tiket satu baris: nama, kuota, progress bar tipis terpesan/kuota ("42 dari 100 terpesan · Gratis"), tombol "Simpan" dan "Hapus" (ghost).
- Bagian "Tambah tiket": Nama tiket + Kuota + tombol "Tambah" dalam satu baris.
- Kosong: "Belum ada tiket. Acara butuh minimal satu jenis tiket sebelum bisa diterbitkan."

### 3.5 Formulir `/organizer/events/[id]/form`

- Judul "Formulir pendaftaran", sub "Pertanyaan tambahan muncul setelah isian wajib, sesuai urutan di bawah."
- Daftar bernomor: 3 isian tetap (Nama lengkap, Email, Nomor HP) dengan badge outline "Selalu ada" dan ikon `lock`.
- Pertanyaan tambahan: label 14/600, meta "Teks · wajib" / "Pilihan tunggal · opsional · S1, S2, Umum"; aksi ikon naik/turun, "Ubah" (membuka form di tempat), "Hapus".
- "Tambah pertanyaan": Pertanyaan, Tipe (Teks / Pilihan tunggal / Dropdown), Pilihan (textarea, "Satu pilihan per baris."), checkbox wajib, tombol "Tambah".
- Panel kanan opsional di desktop: pratinjau formulir seperti yang dilihat peserta (read-only).

### 3.6 Peserta `/organizer/events/[id]/participants`

- Baris ringkasan 3 stat kecil (bukan kartu besar): Terdaftar, Hadir, Batal. Angka 24/700 tabular.
- Pencarian "Cari nama atau email" + tombol "Cari".
- Tabel: Nama, Email, HP, Tiket, kolom pertanyaan tambahan, Status (badge Terdaftar outline / Hadir hijau / Batal merah), aksi "Batalkan" untuk yang Terdaftar.
- Tabel scroll horizontal di dalam kartu; kolom Nama sticky kiri.
- Paginasi bawah: "Halaman 1 dari 4 · 87 peserta", tombol "Sebelumnya"/"Berikutnya".
- Kosong: "Belum ada pendaftar." / hasil cari: "Tidak ada peserta yang cocok dengan "rina"."
- Mobile: tabel jadi daftar kartu (nama, email, tiket, badge).

### 3.7 Check-in `/organizer/events/[id]/checkin` (prioritas mobile)

- Atas: angka besar "64" + "dari 87 peserta sudah hadir" + progress bar.
- Area kamera: kotak rasio 1:1 (mobile penuh lebar), bingkai sudut putih, teks "Arahkan kamera belakang ke QR di tiket peserta. Layar tetap menyala selama scanner aktif." Tombol "Nyalakan kamera".
- Hasil scan: overlay layar penuh `CheckinResultScreen` (lihat 03-components) dengan varian: "Check-in berhasil" (hijau, nama + tiket), "Sudah check-in" (kuning, "Tiket ini sudah dipakai masuk."), "Bukan tiket acara ini" (merah), "Tiket tidak valid" (merah). Varian berhasil punya tombol "Salah scan, batalkan".
- "Scan terakhir": 5 baris (nama, jam, status) di bawah kamera. Kosong: "Belum ada tiket yang di-scan di perangkat ini."
- Cari manual: input "Nama, email, atau nomor HP", hint "Untuk peserta yang QR-nya tidak terbaca atau tidak membawa HP.", hasil dengan tombol "Check-in".
- Error kamera: "Izin kamera ditolak. Izinkan kamera di pengaturan browser, lalu coba lagi." + "Coba buka kamera lagi".
- Desktop: kamera kiri, scan terakhir + cari manual kanan.
- Ditutup (Draf): pesan kosong "Terbitkan acara dulu sebelum membuka check-in."

### 3.8 Sertifikat `/organizer/events/[id]/certificate`

Susun sebagai **3 langkah berurutan** dengan nomor Geist Mono (01, 02, 03) dan status tiap langkah:

1. **Desain sertifikat**: editor. Kiri pratinjau `CertificateMock` besar (A4 landscape). Kanan panel 320px dengan tab "Tampilan" (Border: Klasik/Tipis/Sudut/Tanpa; Warna aksen: 6 swatch teal/navy/burgundy/forest/violet/bronze; font judul, nama, isi) dan "Tata letak" (pilih elemen, tombol panah geser, Perbesar/Perkecil huruf, Perbesar/Perkecil QR, rata Kiri/Tengah/Kanan). Bar bawah: "Ada perubahan yang belum disimpan." + "Simpan perubahan". Bila terkunci: badge `lock` "Desain terkunci" + tombol "Buka kunci desain" (dialog konfirmasi "Buka kunci desain?" dengan peringatan semua tanda tangan direset). Info belum terkunci: "Desain belum terkunci. Terkunci otomatis setelah tanda tangan pertama."
2. **Penandatangan** (maks 3): tiap baris nama + jabatan + email, badge status (Menunggu abu / Sudah tanda tangan hijau / Menolak merah + alasan / Tautan kedaluwarsa kuning), aksi "Buat ulang tautan", "Hapus". Form "Tambah penandatangan": Nama lengkap dan gelar, Jabatan (placeholder "Ketua Pelaksana"), Email, tombol "Tambah dan buat tautan". Setelah dibuat: kotak tautan tampil sekali + "Salin tautan" + "Bagikan ke WhatsApp".
3. **Terbitkan**: stat "Sudah terbit" dan "Hadir, menunggu". Tombol "Terbitkan sertifikat" (atau "Terbitkan susulan" setelah pernah terbit). Bila terblokir, tampilkan alasan: "Tambahkan minimal satu penandatangan." / "Semua penandatangan harus sudah tanda tangan." / "Sertifikat baru bisa diterbitkan setelah acara dimulai."

Di bawahnya **daftar sertifikat terbit**: nama peserta, nomor (Geist Mono, contoh `AC-2610-0001-K7Q2XM`), badge "Dicabut" bila dicabut, aksi "Cabut" (dialog dengan field Alasan + teks "Alasan tersimpan di catatan audit dan tidak ditampilkan ke publik.").

Mobile: langkah ditumpuk; panel editor jadi sheet bawah di atas pratinjau.

### 3.9 Jadi panitia `/organizer/join`

- Tanpa sidebar (pengguna belum panitia). Layout terpusat, kartu 440px, logo di atas.
- Judul "Jadi panitia", sub "Isi data penyelenggara untuk mulai membuat acara. Kontak ini bisa dilihat peserta yang mendaftar."
- Field: Nama penyelenggara (hint "Tampil di halaman acara dan sertifikat."), Email kontak (opsional), Nomor HP kontak. Tombol lebar penuh "Aktifkan akun panitia".

## 4. Aturan visual dashboard

- Dashboard lebih padat dari landing: body 14/22, H1 24/32, H2 18/26. Jarak antar bagian 32px.
- Kartu hanya untuk mengelompokkan isi yang memang satu kesatuan (form, panel terbit, langkah sertifikat). Jangan bungkus semua hal dalam kartu.
- Angka pakai tabular figures. Kode tiket & nomor sertifikat pakai Geist Mono.
- Tombol utama satu per area. Aksi merusak (hapus, batalkan, cabut) selalu outline/ghost merah + dialog konfirmasi.
- State wajib ada di desain: kosong, loading (skeleton baris), error, disabled (acara Dibatalkan/Dinonaktifkan membuat form read-only).
- Tanpa grafik/chart, tanpa "aktivitas terbaru", tanpa angka pendapatan: datanya belum ada.

## 5. Prompt pen.dev

### Prompt D0: token

```
Update the Acaraloka design system: primary #0F5257 (dark mode #7CC7C4, text on primary #10202A in dark), primary-foreground #FFFFFF, accent-amber #E9A23B used only for small indicators, ink #10202A for headings, sidebar background #F7F8F8 (dark #1E1E1E). Keep status colors green #16A34A, yellow #CA8A04, red #DC2626, grey #737373. Update existing Button, Badge, Card components to the new primary.
```

### Prompt D1: shell + daftar acara

```
Desktop frame 1280px. Build the organizer dashboard shell from section 2 of 06-organizer-dashboard.md: 248px left sidebar (logo, organizer name "HIMA Informatika ITS", full-width "Buat acara" button, menu "Acara", group "Akun" with "Tiket saya", "Sertifikat saya", user block at bottom). Active item: primary 8% background, 2px amber left bar.
Content: page 3.1 event list. Row cards (not a uniform grid) grouped "Akan datang" and "Sudah lewat", each with 64px poster thumbnail, title, date "Sab, 12 Okt 2026 · 09.00 WIB", status badge, chevron. Also draw the empty state as a second frame.
```

### Prompt D2: header acara + detail

```
Using the same shell, build the event header (breadcrumb, title + status badge, meta line, "Lihat halaman publik" button, underline tabs Detail/Tiket/Formulir/Peserta/Check-in/Sertifikat) and page 3.3 for a Draf event "Seminar Karier Data 2026": publish checklist card, two-column edit form + poster panel, danger zone "Hapus draf". Then a second frame for a Terbit event with public link row and "Batalkan acara". Add a third frame with the "Acara ini dinonaktifkan admin" banner and read-only form.
```

### Prompt D3: buat acara + tiket + formulir

```
Build pages 3.2 (new event form, max 640px, one field in error state), 3.4 (ticket types with thin quota progress bars and inline add row), and 3.5 (registration form builder: 3 locked fixed fields with "Selalu ada" badge, custom questions with up/down/Ubah/Hapus, add-question form, optional read-only participant preview on the right). Copy from 06-organizer-dashboard.md.
```

### Prompt D4: peserta

```
Build page 3.6 participants for "Workshop Desain UI Dasar": compact stat row (Terdaftar 87, Hadir 64, Batal 3), search, table inside a card with sticky name column, extra columns "Asal instansi" and "Pekerjaan", status badges, "Batalkan" action, pagination "Halaman 1 dari 4 · 87 peserta". Use realistic Indonesian names. Also a mobile 390px frame where rows become cards.
```

### Prompt D5: check-in (mobile dulu)

```
Mobile frame 390px first: page 3.7 check-in. Big counter "64 dari 87 peserta sudah hadir" with progress bar, square camera area with white corner brackets, "Nyalakan kamera" button, "Scan terakhir" list, manual search. Then four full-screen result overlays (Check-in berhasil green with "Salah scan, batalkan", Sudah check-in yellow, Bukan tiket acara ini red, Tiket tidak valid red) and the camera permission error state. Then a desktop 1280px version: camera left, recent scans + manual search right.
```

### Prompt D6: sertifikat

```
Build page 3.8 certificate as three numbered steps (Geist Mono 01/02/03) with per-step status. Step 01: editor with large A4 landscape CertificateMock preview left, 320px right panel with tabs "Tampilan" (border presets, 6 accent swatches, font pickers) and "Tata letak" (element select, arrow nudge buttons, size +/-), unsaved-changes bar. Step 02: signers list with status badges (Menunggu, Sudah tanda tangan, Menolak, Tautan kedaluwarsa), add-signer form, one-time link box with "Salin tautan" and "Bagikan ke WhatsApp". Step 03: issue panel with "Sudah terbit 40" and "Hadir, menunggu 24", "Terbitkan susulan" button. Below: issued certificates list with mono numbers like AC-2610-0001-K7Q2XM and a "Cabut" dialog. Add a locked-design variant of step 01.
```

### Prompt D7: jadi panitia + mobile + dark

```
Build page 3.9 "Jadi panitia" centered card without sidebar. Then mobile 390px versions of 3.1, 3.3, 3.6 and 3.8 with the topbar + sheet menu and horizontally scrolling event tabs. Finally duplicate 3.1 and 3.6 in dark mode tokens (background #252525, primary #7CC7C4). Keep certificate previews white.
```
