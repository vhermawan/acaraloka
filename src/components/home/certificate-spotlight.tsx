import { Check, QrCode } from "lucide-react";

import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/home/section-heading";
import { SignatureScribble } from "@/components/home/signature-scribble";
import { certificateSerif } from "@/components/home/certificate-font";
import { CERTIFICATE_CREDIT } from "@/lib/brand";
import { cn } from "@/lib/utils";

const CHECKS = [
  "Nomor sertifikat unik dan bisa diverifikasi lewat QR",
  "Satu sampai tiga blok tanda tangan per sertifikat",
  "Peserta mengunduh sertifikat dalam format PDF",
];

const SIGNERS = [
  { name: "Dr. Andi Nugroho", role: "Ketua Pelaksana" },
  { name: "Sari Wulandari", role: "Narasumber" },
];

const CALLOUTS = [
  { label: "Nama otomatis mengecil kalau terlalu panjang", side: "left", top: "top-[38%]" },
  { label: "Tanda tangan penandatangan", side: "right", top: "top-[68%]" },
  { label: "QR ke halaman verifikasi", side: "right", top: "top-[88%]" },
] as const;

function CertificateMock() {
  return (
    <div className="@container flex aspect-[840/594] w-full flex-col items-center justify-between bg-card p-[5.7cqw] ring-1 ring-border">
      <div className="flex flex-col items-center gap-[1.4cqw]">
        <p className="pl-[1.2cqw] text-[1.9cqw] font-bold tracking-[1.2cqw] text-foreground">SERTIFIKAT</p>
        <span className="h-[0.25cqw] w-[7.6cqw] bg-primary" />
      </div>
      <div className="flex flex-col items-center gap-[1cqw] text-center">
        <p className="text-[1.8cqw] text-muted-foreground">diberikan kepada</p>
        <p className={cn(certificateSerif.className, "text-[5.7cqw] leading-[1.25] font-semibold text-foreground")}>Rina Pratama</p>
        <p className="max-w-[62cqw] text-[1.8cqw] leading-[1.6] text-muted-foreground">
          atas partisipasinya sebagai Peserta dalam Workshop Desain UI Dasar, 12 Oktober 2026
        </p>
      </div>
      <div className="flex justify-center gap-[7.6cqw]">
        {SIGNERS.map((signer) => (
          <div key={signer.name} className="flex w-[26cqw] flex-col items-center gap-[0.8cqw]">
            <SignatureScribble className="h-[5.7cqw] w-[13.5cqw]" />
            <span className="h-px w-full bg-border" />
            <p className="text-[1.8cqw] font-semibold text-foreground">{signer.name}</p>
            <p className="text-[1.6cqw] text-muted-foreground">{signer.role}</p>
          </div>
        ))}
      </div>
      <div className="flex w-full items-end justify-between">
        <p className="text-[1.5cqw] text-muted-foreground">{CERTIFICATE_CREDIT}</p>
        <div className="flex items-center gap-[1.6cqw]">
          <div className="flex flex-col items-end">
            <p className="text-[1.4cqw] text-muted-foreground">verifikasi</p>
            <p className="font-mono text-[1.5cqw] text-foreground">HDR/2026/X/0184</p>
          </div>
          <QrCode className="size-[6cqw] text-foreground" strokeWidth={1.75} />
        </div>
      </div>
    </div>
  );
}

function CertificateSpotlight() {
  return (
    <section id="sertifikat" aria-labelledby="sertifikat-heading" className="scroll-mt-16 bg-muted py-[72px] lg:pt-[100px] lg:pb-[120px]">
      <Container className="flex max-w-[75rem] flex-col gap-12">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-16">
          <SectionHeading id="sertifikat-heading" eyebrow="sertifikat" title="Sertifikat bertanda tangan, hanya untuk yang hadir" />
          <div className="flex flex-col gap-5">
            <p className="text-[17px] leading-7 text-pretty text-neutral-600">
              Nama peserta, nama acara, dan nomor sertifikat diisi dari data pendaftaran. Kamu tinggal memeriksa sekali, lalu
              terbitkan ke semua peserta yang check-in.
            </p>
            <ul className="flex flex-col gap-3">
              {CHECKS.map((item) => (
                <li key={item} className="flex gap-3 text-[15px] leading-6 text-foreground">
                  <Check className="mt-0.5 size-[18px] shrink-0 text-primary" strokeWidth={2} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[840px]">
          <CertificateMock />
          {CALLOUTS.map((callout) => (
            <p
              key={callout.label}
              className={cn(
                "absolute hidden w-[150px] -translate-y-1/2 items-center gap-2.5 text-xs leading-[18px] text-neutral-600 xl:flex",
                callout.top,
                callout.side === "left" ? "right-full mr-2.5 flex-row text-right" : "left-full ml-2.5 flex-row-reverse justify-end",
              )}
            >
              <span>{callout.label}</span>
              <span className="h-px w-7 shrink-0 bg-neutral-400" aria-hidden="true" />
            </p>
          ))}
        </div>
      </Container>
    </section>
  );
}

export { CertificateSpotlight };
