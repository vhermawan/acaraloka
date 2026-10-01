import type { Metadata } from "next";

import { LegalDocument } from "@/components/legal/legal-document";
import { LEGAL_OPERATOR } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Kebijakan Privasi | event-in",
  description: "Data apa yang dikumpulkan event-in, untuk apa, dan hakmu atas data tersebut.",
};

export default function PrivacyPage() {
  return (
    <LegalDocument title="Kebijakan Privasi">
      <p>
        Kebijakan ini menjelaskan data pribadi yang diproses event-in saat kamu
        memakai layanan, sesuai Undang-Undang Nomor 27 Tahun 2022 tentang
        Pelindungan Data Pribadi.
      </p>

      <h2>Pengendali data</h2>
      <p>
        event-in dikelola oleh {LEGAL_OPERATOR.name}, {LEGAL_OPERATOR.address}.
        Untuk pertanyaan atau permintaan terkait data pribadi, hubungi{" "}
        {LEGAL_OPERATOR.email}.
      </p>
      <p>
        Data yang kamu isi saat mendaftar sebuah acara juga diproses oleh
        panitia acara tersebut. Untuk data itu, panitia bertindak sebagai
        pengendali data bersama kami.
      </p>

      <h2>Data yang kami kumpulkan</h2>
      <ul>
        <li>Dari akun Google: nama, alamat email, dan foto profil.</li>
        <li>Nomor HP yang kamu isi.</li>
        <li>Jawaban formulir pendaftaran yang diminta panitia.</li>
        <li>Riwayat pendaftaran, kehadiran, dan sertifikat.</li>
        <li>Data teknis sesi: alamat IP dan jenis browser.</li>
      </ul>

      <h2>Dasar dan tujuan pemrosesan</h2>
      <ul>
        <li>Persetujuanmu, yang dicatat beserta waktu dan versi dokumen ini.</li>
        <li>
          Pelaksanaan layanan: membuat akun, mencatat pendaftaran, menerbitkan
          e-tiket, mencatat check-in, dan menerbitkan sertifikat.
        </li>
        <li>Keamanan layanan: mencegah penyalahgunaan dan memperbaiki error.</li>
      </ul>

      <h2>Siapa yang bisa melihat datamu</h2>
      <p>
        Nomor HP dan jawaban formulir hanya terlihat oleh panitia acara yang
        kamu daftari dan admin event-in. Nama dan nomor sertifikat tampil di
        halaman verifikasi sertifikat publik. Kami tidak menjual data pribadi.
      </p>
      <p>
        Data disimpan di penyedia infrastruktur kami: Supabase (basis data dan
        penyimpanan berkas, wilayah Singapura) dan Vercel (hosting aplikasi).
      </p>

      <h2>Penyimpanan</h2>
      <p>
        Data akun disimpan selama akunmu aktif. Data pendaftaran dan sertifikat
        disimpan agar sertifikat tetap bisa diverifikasi. Log error dihapus
        otomatis setelah 30 hari.
      </p>

      <h2>Hakmu</h2>
      <p>
        Kamu berhak meminta akses, perbaikan, atau penghapusan data pribadimu,
        serta menarik persetujuan. Kirim permintaan ke {LEGAL_OPERATOR.email}.
        Penghapusan data dapat membuat sertifikat yang sudah terbit tidak bisa
        diverifikasi lagi.
      </p>

      <h2>Perubahan kebijakan</h2>
      <p>
        Jika kebijakan ini berubah, kami akan meminta persetujuanmu lagi saat
        kamu masuk berikutnya.
      </p>
    </LegalDocument>
  );
}
