import type { Metadata } from "next";

import { LegalDocument } from "@/components/legal/legal-document";
import { LEGAL_OPERATOR } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Syarat Layanan | event-in",
  description: "Aturan pemakaian event-in untuk peserta dan panitia acara.",
};

export default function TermsPage() {
  return (
    <LegalDocument title="Syarat Layanan">
      <p>
        Dengan memakai event-in, kamu menyetujui syarat berikut. event-in
        dikelola oleh {LEGAL_OPERATOR.name}, {LEGAL_OPERATOR.address}, kontak{" "}
        {LEGAL_OPERATOR.email}.
      </p>

      <h2>Layanan</h2>
      <p>
        event-in adalah alat bantu bagi panitia untuk mengelola pendaftaran,
        e-tiket, check-in, dan sertifikat acara. event-in bukan penyelenggara
        acara yang tampil di platform.
      </p>

      <h2>Akun</h2>
      <ul>
        <li>Kamu masuk memakai akun Google dan bertanggung jawab atas aktivitas di akunmu.</li>
        <li>Data yang kamu isi harus benar.</li>
        <li>Kami dapat menonaktifkan akun yang melanggar syarat ini.</li>
      </ul>

      <h2>Kewajiban panitia</h2>
      <ul>
        <li>Informasi acara harus akurat dan acara tidak melanggar hukum.</li>
        <li>
          Data peserta hanya dipakai untuk keperluan acara tersebut dan
          dilindungi sesuai Kebijakan Privasi.
        </li>
        <li>Panitia bertanggung jawab atas pelaksanaan, perubahan, dan pembatalan acara.</li>
      </ul>

      <h2>Pembatalan dan refund</h2>
      <p>
        Refund sepenuhnya menjadi tanggung jawab panitia acara. event-in tidak
        memegang dana peserta, tidak memproses refund, dan tidak menjamin
        refund. Jika acara dibatalkan, event-in hanya menghentikan pendaftaran,
        menampilkan status pembatalan, dan meneruskan informasi dari panitia.
      </p>

      <h2>Sertifikat</h2>
      <p>
        Sertifikat diterbitkan oleh panitia. event-in menyediakan halaman
        verifikasi agar keaslian sertifikat bisa dicek, tetapi tidak menilai isi
        maupun kelayakan penerbitannya.
      </p>

      <h2>Batasan tanggung jawab</h2>
      <p>
        Layanan disediakan apa adanya. Kami berusaha menjaga layanan tetap
        tersedia, tetapi tidak bertanggung jawab atas kerugian akibat gangguan
        layanan, kesalahan data dari panitia, atau pelaksanaan acara.
      </p>

      <h2>Perubahan syarat</h2>
      <p>
        Jika syarat ini berubah, kami akan meminta persetujuanmu lagi saat kamu
        masuk berikutnya. Syarat ini tunduk pada hukum Republik Indonesia.
      </p>
    </LegalDocument>
  );
}
