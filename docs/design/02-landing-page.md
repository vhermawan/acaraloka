# 02. Landing page Acaraloka

Frame: desktop 1440px dan mobile 390px. Urutan section di bawah sudah final; copy boleh disunting, angka jangan dikarang.

## 0. Header (sticky)

- Kiri: wordmark Acaraloka.
- Tengah (desktop): Fitur, Cara kerja, Sertifikat, Harga, FAQ. Link ke anchor di halaman yang sama.
- Kanan: link "Masuk" (teks) + tombol primary "Buat acara gratis".
- Mobile: wordmark + tombol menu. Menu terbuka sebagai sheet dari atas, tombol "Buat acara gratis" lebar penuh di bawah.
- Latar putih dengan border bawah 1px setelah halaman di-scroll.

## 1. Hero

Layout desktop: dua kolom 6/6. Kiri teks, kanan visual produk. Mobile: teks dulu, visual di bawah.

**Eyebrow (kecil, teal):** Untuk panitia seminar, workshop, dan meetup

**H1:** Dari pendaftaran sampai sertifikat, semua di Acaraloka

**Subjudul:** Buka pendaftaran, kirim e-tiket QR, scan kehadiran di pintu masuk, lalu terbitkan sertifikat bertanda tangan untuk peserta yang benar-benar hadir.

**Tombol:**
- Primary: "Buat acara gratis"
- Secondary (outline): "Lihat cara kerjanya" (scroll ke section 3)

**Catatan kecil di bawah tombol:** Gratis untuk acara tanpa tiket berbayar. Masuk pakai akun Google.

**Visual kanan:** komposisi tiga lapis yang saling menumpuk sedikit:
1. Belakang: sertifikat landscape (A4) dengan nama peserta, dua tanda tangan, dan QR verifikasi di pojok kanan bawah.
2. Tengah: HP dengan layar check-in hijau penuh bertuliskan "VALID" dan nama peserta.
3. Depan kecil: kartu e-tiket dengan QR dan judul acara.

Jangan pakai screenshot palsu dengan data asli; pakai nama contoh seperti "Rina Pratama" dan acara "Workshop Desain UI Dasar".

## 2. Masalah (strip pendek)

Latar `muted`. Satu baris judul + empat item kecil dengan ikon "x" abu-abu.

**H2:** Kalau masih begini, Acaraloka bisa bantu

- Pendaftaran lewat Google Form, rekap manual di spreadsheet
- Absen pakai kertas yang antre di meja registrasi
- Sertifikat diketik satu per satu, nama sering salah
- Peserta yang tidak datang ikut minta sertifikat

## 3. Cara kerja (4 langkah)

**H2:** Empat langkah, satu dashboard

Layout desktop: timeline horizontal 4 kolom dengan nomor besar (Geist Mono) dan garis penghubung. Mobile: vertikal.

1. **Buat acara.** Isi judul, jadwal, lokasi, poster, jenis tiket, dan kuota. Tambah pertanyaan sendiri di formulir pendaftaran.
2. **Bagikan tautan.** Peserta daftar dari HP dan langsung dapat e-tiket QR di menu Tiket Saya.
3. **Scan di pintu masuk.** Buka kamera HP panitia, arahkan ke QR. Layar berubah hijau kalau valid, kuning kalau tiket sudah dipakai.
4. **Terbitkan sertifikat.** Penandatangan tanda tangan lewat tautan dari HP. Sertifikat hanya terbit untuk peserta yang sudah check-in.

## 4. Fitur utama (bento grid)

**H2:** Yang biasanya dikerjakan lima aplikasi

Desktop: grid bento 3 kolom dengan ukuran kartu berbeda (bukan 6 kartu sama besar). Mobile: satu kolom.

| Kartu | Ukuran | Judul | Isi | Visual |
|---|---|---|---|---|
| A | 2 kolom, tinggi | Check-in yang tidak bisa dicurangi | Satu tiket hanya bisa di-scan sekali, walau dua HP panitia scan bersamaan. Salah scan bisa dibatalkan. Cari nama kalau peserta lupa bawa HP. | Mockup layar scan dengan 3 state: hijau VALID, kuning SUDAH CHECK-IN 09.12, merah BUKAN ACARA INI |
| B | 1 kolom, tinggi | Tanda tangan dari HP | Kirim tautan ke penandatangan lewat WhatsApp. Mereka lihat pratinjau, setujui, lalu tanda tangan di layar. Tidak perlu bikin akun. | Mockup HP dengan kanvas tanda tangan |
| C | 1 kolom | Formulir sesuai kebutuhan | Tambah pertanyaan: teks singkat, pilihan, atau dropdown. Ukuran kaos, asal kampus, apa saja. | Potongan form builder |
| D | 1 kolom | Daftar peserta rapi | Cari, lihat status, dan pantau siapa yang sudah hadir. | Tabel mini dengan badge status |
| E | 1 kolom | Sertifikat bisa dicek keasliannya | Tiap sertifikat punya nomor unik dan QR ke halaman verifikasi publik. | Potongan halaman verifikasi dengan label "Terverifikasi di Acaraloka" |

## 5. Sorotan sertifikat

Section paling penting karena ini pembeda Acaraloka. Latar putih, visual besar.

**Eyebrow:** Sertifikat

**H2:** Sertifikat bertanda tangan, hanya untuk yang hadir

**Body:** Atur posisi nama, nomor, tanggal, dan tanda tangan di template, lalu lihat pratinjau PDF-nya. Desain terkunci begitu penandatangan pertama tanda tangan, jadi tidak ada yang berubah diam-diam. Peserta mengunduh sertifikat dari menu Sertifikat Saya.

**Daftar centang (3 baris):**
- Sampai 3 penandatangan per acara
- Nomor unik dan QR verifikasi di setiap sertifikat
- Peserta bisa membetulkan ejaan nama sebelum sertifikat terbit

**Visual:** sertifikat besar di tengah, dikelilingi label callout bergaris tipis yang menunjuk ke bagian-bagiannya: "Nama otomatis mengecil kalau panjang", "Tanda tangan penandatangan", "QR ke halaman verifikasi".

## 6. Segera hadir: AI pembuat template

Kartu lebar dengan border teal tipis dan badge "Segera hadir". Detail fitur ada di `04-ai-certificate.md`.

**H3:** Tulis gaya yang kamu mau, Acaraloka siapkan templatenya

**Body:** Ketik misalnya "sertifikat workshop fotografi, nuansa hangat, ada logo kampus di kiri atas". Acaraloka membuat beberapa pilihan template yang bisa kamu atur lagi di editor.

**Visual:** kolom input prompt di kiri, tiga thumbnail template hasil di kanan (desain berbeda: formal, minimal, berwarna).

**Tombol (ghost):** "Kabari saya saat rilis" (opsional, kalau ada form waitlist; kalau tidak, hapus tombolnya).

## 7. Untuk siapa (3 peran)

**H2:** Satu akun, tiga peran

Tiga kolom, masing-masing dengan foto/ilustrasi kecil dan dua kalimat.

- **Panitia.** Kelola pendaftaran, check-in, dan sertifikat dari satu dashboard. Bisa dipakai sendirian.
- **Peserta.** Daftar dari HP, simpan e-tiket, dan unduh sertifikat setelah acara.
- **Penandatangan.** Terima tautan, periksa pratinjau, tanda tangan. Selesai dari HP.

## 8. Harga

**H2:** Gratis untuk acara gratis

Dua kartu berdampingan.

| | Acara gratis | Acara berbayar |
|---|---|---|
| Badge | Tersedia sekarang | Segera hadir |
| Harga | Rp0 | `[ISI: tarif final]` |
| Isi | Peserta tanpa batas, e-tiket QR, check-in, sertifikat dengan 1 sampai 3 penandatangan | Semua fitur acara gratis, pembayaran QRIS langsung ke akun Mayar milik panitia |
| Tombol | "Buat acara gratis" (primary) | tanpa tombol, atau "Kabari saya" |

**Catatan di bawah kartu:** Sertifikat memuat tulisan kecil "Diterbitkan via Acaraloka".

Tarif acara berbayar di rencana (4%, minimum Rp2.000 per tiket) belum divalidasi. Jangan tampilkan angkanya sebelum diputuskan.

## 9. FAQ

Accordion, 6 pertanyaan.

1. **Apakah peserta harus punya akun?** Ya. Peserta masuk pakai akun Google supaya e-tiket dan sertifikat tersimpan di satu tempat.
2. **Penandatangan perlu daftar?** Tidak. Panitia mengirim tautan khusus, penandatangan cukup membukanya dari HP.
3. **Bagaimana kalau peserta lupa bawa HP?** Panitia bisa mencari nama, email, atau nomor HP peserta di halaman check-in.
4. **Apakah sertifikatnya sah?** Sertifikat diterbitkan oleh panitia acara. Acaraloka mencatat nomornya dan menyediakan halaman verifikasi publik, tapi tanda tangannya bukan tanda tangan elektronik tersertifikasi.
5. **Bisa pakai desain sertifikat sendiri?** Saat ini tersedia template bawaan yang posisinya bisa diatur. Unggah desain sendiri dan AI pembuat template sedang disiapkan.
6. **Apakah ada biaya?** Acara gratis tidak dikenai biaya. Acara berbayar segera hadir.

## 10. CTA penutup

Satu-satunya blok penuh warna teal di halaman. Teks putih, rata tengah.

**H2:** Acara berikutnya, absennya pakai QR

**Body:** Buat acara pertamamu dalam beberapa menit.

**Tombol:** putih dengan teks teal, "Buat acara gratis".

## 11. Footer

- Kiri: wordmark + satu kalimat posisi (dari `01-brand.md`).
- Kolom link: Produk (Fitur, Harga, FAQ), Legal (Syarat Layanan `/legal/terms`, Kebijakan Privasi `/legal/privacy`), Akun (Masuk, Tiket Saya).
- Bawah: "© 2026 Acaraloka."

## Catatan responsif

- Hero mobile: H1 36px, visual tiga lapis disederhanakan jadi HP + sertifikat saja.
- Bento grid mobile: satu kolom, urutan A, B, E, C, D.
- Timeline cara kerja mobile: vertikal dengan garis di kiri.
- Semua tombol minimal tinggi 44px.
