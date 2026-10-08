import { Check, PenLine, Ticket, Users } from "lucide-react";

import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/home/section-heading";

const ROLES = [
  {
    name: "Panitia",
    icon: Users,
    body: "Buat acara, pantau pendaftar, scan tiket di meja registrasi, lalu terbitkan sertifikat sekali jalan.",
    points: ["Dashboard pendaftar", "Scanner QR di HP", "Penerbitan sertifikat massal"],
  },
  {
    name: "Peserta",
    icon: Ticket,
    body: "Daftar dari HP, simpan e-tiket di Tiket Saya, tunjukkan QR saat datang, sertifikat menyusul setelah acara.",
    points: ["Form pendaftaran singkat", "E-tiket QR", "Sertifikat PDF siap unduh"],
  },
  {
    name: "Penandatangan",
    icon: PenLine,
    body: "Terima link, periksa isi sertifikat, tanda tangan di layar HP. Tidak perlu bikin akun.",
    points: ["Link tanpa akun", "Tanda tangan di layar", "Pratinjau sebelum tanda tangan"],
  },
];

function Roles() {
  return (
    <section aria-labelledby="peran-heading" className="pb-[72px] lg:pb-[120px]">
      <Container className="flex max-w-[75rem] flex-col gap-10">
        <SectionHeading id="peran-heading" eyebrow="siapa yang pakai" title="Satu acara, tiga orang yang dimudahkan" />
        <div className="grid items-start gap-6 md:grid-cols-3">
          {ROLES.map(({ name, icon: Icon, body, points }) => (
            <article key={name} className="flex flex-col gap-3.5 rounded-xl bg-card p-7 ring-1 ring-border">
              <Icon className="size-[22px] text-primary" strokeWidth={1.5} aria-hidden="true" />
              <h3 className="text-[22px] leading-[30px] font-semibold tracking-[-0.2px] text-foreground">{name}</h3>
              <p className="border-b border-border pb-4 text-[15px] leading-[25px] text-pretty text-muted-foreground">{body}</p>
              <ul className="flex flex-col gap-2">
                {points.map((point) => (
                  <li key={point} className="flex items-center gap-2.5 text-sm text-foreground">
                    <Check className="size-4 shrink-0 text-primary" strokeWidth={2} aria-hidden="true" />
                    {point}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}

export { Roles };
