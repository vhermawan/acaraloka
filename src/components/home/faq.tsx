import { ChevronDown } from "lucide-react";

import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/home/section-heading";
import { APP_NAME } from "@/lib/brand";

const QUESTIONS = [
  {
    question: `${APP_NAME} gratis atau berbayar?`,
    answer:
      "Gratis untuk acara tanpa tiket berbayar. Kamu bisa buat acara, sebar link pendaftaran, scan tiket, dan terbitkan sertifikat tanpa biaya.",
  },
  {
    question: "Peserta harus bikin akun dulu?",
    answer: "Peserta masuk pakai akun Google, tanpa isi formulir akun. E-tiket dan sertifikat jadi tersimpan di satu tempat.",
  },
  {
    question: "Bagaimana kalau peserta lupa bawa HP?",
    answer: "Panitia bisa mencari nama, email, atau nomor HP peserta di halaman check-in, lalu menandai kehadirannya dari sana.",
  },
  {
    question: "Bisa pakai lebih dari satu penandatangan?",
    answer:
      "Bisa, sampai tiga penandatangan per acara. Masing-masing dapat link sendiri dan tanda tangan dari HP tanpa bikin akun.",
  },
  {
    question: "Sertifikatnya bentuknya apa?",
    answer:
      "PDF ukuran A4 mendatar. Posisi nama, nomor, tanggal, dan tanda tangan bisa kamu atur di template, dan setiap sertifikat punya nomor unik dengan QR verifikasi.",
  },
];

function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-heading" className="scroll-mt-16 py-18 lg:py-30">
      <Container className="grid max-w-300 gap-10 lg:grid-cols-[380px_1fr] lg:gap-20">
        <SectionHeading id="faq-heading" eyebrow="pertanyaan" title="Yang sering ditanya panitia" />
        <div className="border-t border-border lg:border-t-0">
          {QUESTIONS.map((item, index) => (
            <details key={item.question} name="faq" open={index === 0} className="group border-b border-border">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-5 text-base font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
                {item.question}
                <ChevronDown
                  className="size-4.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <p className="pb-6 text-base/6.5 text-pretty text-muted-foreground">{item.answer}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}

export { Faq };
