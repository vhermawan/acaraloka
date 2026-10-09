import { Check, QrCode, Timer, X } from "lucide-react";

import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/home/section-heading";
import { SignatureScribble } from "@/components/home/signature-scribble";
import { certificateSerif } from "@/components/home/certificate-font";
import { cn } from "@/lib/utils";

const CHECKIN_STATES = [
  { title: "Check-in berhasil", sub: "Rina Pratama", icon: Check, tone: "bg-green-700 text-white" },
  { title: "Sudah check-in", sub: "pukul 09.12", icon: Timer, tone: "bg-amber-400 text-amber-950" },
  { title: "Bukan tiket acara ini", sub: "Tiket acara lain", icon: X, tone: "bg-red-700 text-white" },
];

const FORM_FIELDS = ["Nama lengkap", "Email", "Asal kampus / instansi"];

type FeatureCardProps = {
  title: string;
  body: string;
  visual: React.ReactNode;
  className?: string;
};

function FeatureCard({ title, body, visual, className }: FeatureCardProps) {
  return (
    <article className={cn("flex flex-col gap-5 rounded-xl bg-card p-5 ring-1 ring-border sm:p-6", className)}>
      <div aria-hidden="true" className="flex min-h-45 items-center justify-center overflow-hidden rounded-lg bg-muted p-5">
        {visual}
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-xl/7.5 font-semibold tracking-[-0.2px] text-foreground">{title}</h3>
        <p className="text-[15px]/6.25 text-pretty text-muted-foreground">{body}</p>
      </div>
    </article>
  );
}

function Features() {
  return (
    <section id="fitur" aria-labelledby="fitur-heading" className="scroll-mt-16 pb-18 lg:pb-30">
      <Container className="flex max-w-300 flex-col gap-10">
        <SectionHeading id="fitur-heading" eyebrow="fitur" title="Alat yang dipakai panitia, bukan fitur hiasan" />

        <div className="grid items-start gap-6 lg:grid-cols-[2fr_1fr]">
          <FeatureCard
            title="Sekali scan, panitia langsung tahu harus apa"
            body="Hijau berarti boleh masuk, kuning berarti tiket sudah dipakai, merah berarti tiket bukan untuk acara ini. Tanpa menebak, tanpa mencari nama di kertas."
            visual={
              <div className="grid w-full gap-3 sm:h-65 sm:grid-cols-3">
                {CHECKIN_STATES.map(({ title, sub, icon: Icon, tone }) => (
                  <div key={title} className={cn("flex flex-col items-center justify-center gap-2.5 rounded-lg p-4 text-center", tone)}>
                    <Icon className="size-8" strokeWidth={2} />
                    <p className="text-lg/6 font-bold text-balance">{title}</p>
                    <p className="text-[13px] opacity-90">{sub}</p>
                  </div>
                ))}
              </div>
            }
          />
          <FeatureCard
            title="E-tiket QR tersimpan di Tiket Saya"
            body="Peserta cukup menunjukkan QR dari HP. Tidak perlu print, tidak perlu daftar ulang di lokasi."
            visual={
              <div className="flex w-full flex-col items-center gap-3 rounded-lg bg-card p-4.5 ring-1 ring-border">
                <p className="text-[15px] font-semibold text-foreground">Workshop Desain UI Dasar</p>
                <p className="text-xs text-muted-foreground">12 Okt 2026 · 09.00 WIB</p>
                <span className="h-px w-full bg-border" />
                <QrCode className="size-24 text-foreground" strokeWidth={1.5} />
                <p className="text-[13px] font-semibold text-foreground">Rina Pratama</p>
                <p className="font-mono text-[11px] text-muted-foreground">HDR-7F2K-9QX1</p>
              </div>
            }
          />
        </div>

        <div className="grid items-start gap-6 md:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            title="Form pendaftaran yang kamu atur sendiri"
            body="Tambah pertanyaan sesuai kebutuhan acara. Kuota dan batas waktu ikut terjaga otomatis."
            visual={
              <div className="flex w-full flex-col gap-2.5 rounded-lg bg-card p-4 ring-1 ring-border">
                {FORM_FIELDS.map((label) => (
                  <div key={label} className="flex flex-col gap-1.5">
                    <p className="text-[11px] text-muted-foreground">{label}</p>
                    <span className="h-6 rounded-md bg-muted ring-1 ring-border" />
                  </div>
                ))}
              </div>
            }
          />
          <FeatureCard
            title="Sertifikat hanya untuk yang benar-benar hadir"
            body="Data check-in jadi dasar penerbitan. Nama diambil dari pendaftaran, jadi tidak ada salah ketik."
            visual={
              <div className="flex w-full flex-col items-center gap-1.5 rounded-lg bg-card p-4 ring-1 ring-border">
                <p className="text-[9px] font-bold tracking-[3px] text-foreground">SERTIFIKAT</p>
                <p className={cn(certificateSerif.className, "text-2xl font-semibold text-foreground")}>Rina Pratama</p>
                <span className="h-px w-36 bg-border" />
                <p className="font-mono text-[10px] text-muted-foreground">HDR/2026/X/0184</p>
              </div>
            }
          />
          <FeatureCard
            className="md:col-span-2 lg:col-span-1"
            title="Penandatangan cukup pakai HP, tanpa bikin akun"
            body="Kirim link ke ketua atau narasumber. Mereka periksa pratinjau, lalu tanda tangan langsung di layar."
            visual={
              <div className="flex w-full flex-col items-center gap-2 rounded-lg bg-card p-4 ring-1 ring-border">
                <SignatureScribble className="h-12 w-37.5" />
                <span className="h-px w-full bg-border" />
                <p className="text-[11px] text-muted-foreground">Saya menyetujui isi sertifikat ini</p>
              </div>
            }
          />
        </div>
      </Container>
    </section>
  );
}

export { Features };
