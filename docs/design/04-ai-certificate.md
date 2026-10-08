# 04. AI pembuat template sertifikat

Status: konsep, belum masuk rencana atau todo. Di landing page tampil sebagai "Segera hadir".

## Masalah

Template bawaan saat ini hanya satu. Panitia yang ingin sertifikat bernuansa acaranya (logo kampus, warna himpunan, tema acara) harus mendesain sendiri di Canva, lalu tidak bisa memakainya di Hadirly karena unggah template belum ada.

## Cara kerja yang diusulkan

AI tidak menggambar sertifikat jadi. AI menghasilkan dua hal:

1. **Latar belakang** (gambar ornamen, bingkai, warna, posisi logo).
2. **Layout** dalam format yang sama dengan `CertificateConfig.layout` (posisi nama, nomor, tanggal, blok tanda tangan, QR, ukuran huruf, perataan).

Teks nama peserta, nomor, tanda tangan, dan QR tetap ditulis oleh renderer PDF Hadirly. Akibatnya nama tidak pernah salah eja oleh AI, QR tetap bisa di-scan, dan hasil AI bisa disunting di editor posisi yang sudah ada.

## Alur panitia

1. Di halaman Sertifikat acara, panitia pilih "Buat dengan AI" (di samping template bawaan).
2. Isi prompt bebas, atau pilih chip gaya. Opsional: unggah logo (PNG/SVG) dan pilih warna utama.
3. Hadirly menampilkan 3 pilihan template dengan data contoh.
4. Panitia pilih satu, lalu masuk ke editor posisi yang sudah ada untuk merapikan.
5. Simpan. Setelah itu alurnya sama: undang penandatangan, desain terkunci saat tanda tangan pertama.

Batas pemakaian per acara (misalnya beberapa kali generate) perlu ditentukan supaya biaya API terkendali.

## Layar yang perlu didesain

### A. Pilihan sumber template

Dua kartu berdampingan: "Template bawaan" dan "Buat dengan AI" (badge "Baru"). Kartu AI menampilkan contoh 2 thumbnail kecil.

### B. Form prompt

- PromptInput (lihat `03-components.md`).
- Placeholder: "Contoh: sertifikat seminar kesehatan, warna hijau tua, formal, ada logo fakultas di tengah atas".
- Chip gaya: Formal kampus, Minimalis, Warna cerah, Klasik dengan bingkai, Modern geometris.
- Unggah logo (opsional), pemilih warna utama (opsional).
- Info kecil: "Nama, nomor, tanda tangan, dan QR diisi otomatis oleh Hadirly. AI hanya membuat desain dan tata letak."
- Sisa kuota generate: "2 dari 3 percobaan tersisa untuk acara ini" (angka contoh, ganti setelah diputuskan).

### C. Sedang membuat

Tiga kartu skeleton seukuran sertifikat dengan animasi shimmer pelan. Teks status: "Menyiapkan 3 pilihan desain". Tombol "Batal".

### D. Hasil

- Tiga CertificateMock berdampingan (desktop) atau carousel (mobile), masing-masing dengan data contoh "Rina Pratama".
- Di bawah tiap kartu: tombol "Pakai template ini" dan link "Buat variasi".
- Di atas: prompt yang dipakai, bisa disunting, tombol "Buat ulang".

### E. Gagal atau ditolak

- Gagal teknis: "Belum berhasil membuat template. Coba lagi sebentar lagi." + tombol "Coba lagi". Kuota tidak berkurang.
- Prompt ditolak (konten tidak pantas): "Permintaan ini tidak bisa diproses. Coba deskripsi lain."

### F. Masuk editor

Editor posisi yang sudah ada, dengan latar hasil AI. Tambahkan label kecil "Dibuat dengan AI" di atas pratinjau.

## Keputusan yang masih terbuka

- Penyedia model (teks untuk layout, gambar untuk latar) dan biayanya. Harus cocok dengan prinsip free tier sampai ada pemasukan.
- Batas generate per acara atau per akun.
- Apakah fitur ini gratis atau khusus acara berbayar.
- Hak pakai gambar hasil AI dan logo yang diunggah panitia (perlu ditambahkan di Syarat Layanan).
- Font: renderer sekarang memakai font standar pdf-lib (Times/Helvetica). Template AI yang butuh font lain berarti perlu menyematkan file TTF.
