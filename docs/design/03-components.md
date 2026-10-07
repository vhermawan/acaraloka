# 03. Komponen

Buat sebagai komponen pen.dev yang dipakai ulang. Nama komponen dalam bahasa Inggris supaya cocok dengan kode (`src/components/ui`, shadcn base-nova).

## Button

| Varian | Latar | Teks | Border |
|---|---|---|---|
| `default` | primary | primary-foreground | - |
| `outline` | background | foreground | border |
| `ghost` | transparan | foreground | - |
| `inverse` (khusus CTA teal) | putih | primary | - |

- Ukuran: `sm` 32px, `default` 40px, `lg` 48px (dipakai di hero dan CTA). Radius 8px, padding horizontal 16/20px, font 500.
- State: hover (gelapkan 8%), focus (ring 2px primary, offset 2px), disabled (opacity 50%).
- Ikon opsional di kanan untuk tombol yang berpindah halaman (Lucide `arrow-right`, 16px).

## Badge

Pill, tinggi 22px, font 12/600.

- `default` teal, `secondary` abu, `destructive` merah, `outline`.
- `soon`: latar `primary` 10%, teks primary, isi "Segera hadir".
- Status pendaftaran: Terkonfirmasi, Sudah check-in, Dibatalkan panitia, Menunggu pembayaran.

## Card

Border 1px, radius 12px, padding 24px, latar background. Varian `muted` untuk kartu sekunder. Tanpa bayangan tebal.

## SectionHeader

Eyebrow (12/600, teal, tanpa huruf kapital semua) + H2 + paragraf pendukung maks 60 karakter per baris. Rata kiri di desktop, boleh rata tengah untuk CTA dan harga.

## PhoneFrame

Bingkai HP sederhana (radius 40px, bezel 10px gelap) berukuran 300x620 untuk mockup. Tanpa notch berlebihan.

## CheckinResultScreen

Isi PhoneFrame. Tiga varian state:

| State | Latar | Judul | Sub |
|---|---|---|---|
| valid | `#16A34A` | VALID | Rina Pratama · Reguler |
| already | `#CA8A04` | SUDAH CHECK-IN | pukul 09.12 |
| invalid | `#DC2626` | BUKAN ACARA INI | Tiket untuk acara lain |

Teks putih, judul 32/700, ikon besar di atas (check, clock, x).

## TicketCard

Kartu e-tiket: judul acara, tanggal + jam + zona (WIB), lokasi, nama peserta, QR 160px di tengah, kode tiket Geist Mono di bawah QR. Potongan setengah lingkaran di kiri-kanan sebagai pemisah sobekan tiket.

## CertificateMock

Sertifikat landscape rasio A4 (297:210).

- Judul "SERTIFIKAT" (tracking lebar boleh di sini karena ini judul dokumen), sub "diberikan kepada".
- Nama peserta besar (serif, misalnya Times/Playfair, karena renderer PDF memakai Times).
- Teks "atas partisipasinya sebagai Peserta dalam Workshop Desain UI Dasar, 12 Oktober 2026".
- 1 sampai 3 blok tanda tangan: gambar TTD, garis, nama, jabatan.
- QR verifikasi + nomor sertifikat (Geist Mono) di pojok kanan bawah.
- Teks kecil "Diterbitkan via Hadirly" di bawah.
- Varian `preview` dengan watermark diagonal "PRATINJAU".

## SignaturePad

Kanvas putih dengan garis dasar putus-putus, tombol "Hapus" (ghost) dan "Simpan tanda tangan" (default). Label persetujuan di atas: "Saya menyetujui isi sertifikat ini".

## FeatureBentoCard

Card dengan area visual di atas (latar muted, radius dalam 8px) dan teks di bawah (H3 + body). Area visual berisi potongan UI, bukan ikon besar.

## FAQItem

Accordion: baris pertanyaan 16/600 dengan ikon chevron, jawaban 16/26 muted-foreground. Border bawah 1px per item.

## PromptInput (untuk fitur AI)

Textarea 3 baris dengan placeholder contoh prompt, chip saran di bawahnya ("Formal kampus", "Minimalis", "Warna cerah", "Ada logo"), tombol "Buat template" dengan ikon Lucide `sparkles` di kanan bawah.
