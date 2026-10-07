import Link from "next/link";
import { Check, Minus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";
import { CREATE_EVENT_HREF } from "@/components/layout/create-event-href";
import { SectionHeading } from "@/components/home/section-heading";

const FREE_FEATURES = [
  "Pendaftaran dan e-tiket QR tanpa batas acara",
  "Check-in dengan scanner di HP panitia",
  "Sertifikat bertanda tangan untuk peserta hadir",
];

const PAID_FEATURES = [
  "Semua fitur acara gratis",
  "Tiket berbayar dengan pembayaran QRIS",
  "Dana masuk langsung ke akun Mayar milik panitia",
];

function Pricing() {
  return (
    <section id="harga" aria-labelledby="harga-heading" className="scroll-mt-16 bg-muted py-[72px] lg:py-[100px]">
      <Container className="flex max-w-[75rem] flex-col items-center gap-10">
        <SectionHeading id="harga-heading" eyebrow="harga" title="Mulai gratis, bayar kalau jualan tiket" align="center" />
        <div className="grid w-full max-w-[900px] items-start gap-6 md:grid-cols-2">
          <article className="flex flex-col gap-4 rounded-xl bg-card p-6 ring-1 ring-primary sm:p-8">
            <span className="inline-flex h-[22px] w-fit items-center rounded-full bg-primary/10 px-2.5 text-xs font-semibold text-primary">
              Tersedia sekarang
            </span>
            <h3 className="text-xl font-semibold text-foreground">Acara gratis</h3>
            <p className="text-[44px] leading-[51px] font-bold tracking-[-1.2px] text-foreground">Rp0</p>
            <ul className="flex flex-col gap-3">
              {FREE_FEATURES.map((feature) => (
                <li key={feature} className="flex gap-2.5 text-[15px] leading-6 text-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={2} aria-hidden="true" />
                  {feature}
                </li>
              ))}
            </ul>
            <Button nativeButton={false} render={<Link href={CREATE_EVENT_HREF} />} className="mt-1 h-11 w-full text-[15px]">
              Buat acara gratis
            </Button>
          </article>

          <article className="flex flex-col gap-4 rounded-xl bg-card p-6 ring-1 ring-border sm:p-8">
            <span className="inline-flex h-[22px] w-fit items-center rounded-full bg-primary/10 px-2.5 text-xs font-semibold text-primary">
              Segera hadir
            </span>
            <h3 className="text-xl font-semibold text-neutral-600">Acara berbayar</h3>
            <p className="flex items-center gap-1 text-[44px] leading-[51px] font-bold tracking-[-1.2px] text-neutral-500">
              Rp
              <span className="h-1 w-8 rounded-full bg-neutral-400" aria-hidden="true" />
              <span className="sr-only">harga belum diumumkan</span>
            </p>
            <ul className="flex flex-col gap-3">
              {PAID_FEATURES.map((feature) => (
                <li key={feature} className="flex gap-2.5 text-[15px] leading-6 text-neutral-600">
                  <Minus className="mt-0.5 size-4 shrink-0 text-neutral-400" aria-hidden="true" />
                  {feature}
                </li>
              ))}
            </ul>
            <p className="text-[13px] text-neutral-600">Harga diumumkan menjelang rilis.</p>
          </article>
        </div>
      </Container>
    </section>
  );
}

export { Pricing };
