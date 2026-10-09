import Link from "next/link";
import { Check, CircleCheck, FileCheck, MailCheck, QrCode, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";
import { CREATE_EVENT_HREF } from "@/components/layout/create-event-href";
import { certificateSerif } from "@/components/home/certificate-font";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/brand";

const floatingCard =
  "absolute flex flex-col gap-3 rounded-xl bg-card p-4 shadow-[0_8px_24px_-6px_rgb(0_0_0/0.08)] ring-1 ring-border origin-top-left";

const ATTENDEES = [
  { name: "Rina Pratama", time: "09.11" },
  { name: "Dimas Saputra", time: "09.12" },
  { name: "Ayu Lestari", time: "09.15" },
  { name: "Bagas Prakoso", time: null },
];

const PROBLEMS = [
  "Pendaftaran tersebar di Google Form dan chat panitia",
  "Absen kertas bikin antre panjang di meja registrasi",
  "Sertifikat diketik satu per satu di Canva",
  "Peserta yang tidak datang ikut dapat sertifikat",
];

function HeroVisual() {
  return (
    <div aria-hidden="true" className="relative mx-auto mt-6 hidden h-87.5 w-full max-w-360 sm:block">
      <div className={cn(floatingCard, "top-27.5 left-[calc(50%-300px)] z-2 w-75 rotate-[9deg] lg:top-33.75 lg:left-[calc(50%-770px)]")}>
        <p className="text-[11px] font-bold tracking-[4px] text-foreground">SERTIFIKAT</p>
        <p className={cn(certificateSerif.className, "text-[28px]/8.75 font-semibold text-foreground")}>Rina Pratama</p>
        <p className="text-xs text-muted-foreground">Peserta Workshop Desain UI Dasar · 12 Okt 2026</p>
        <div className="flex items-end justify-between">
          <p className="font-mono text-[11px] text-muted-foreground">HDR/2026/X/0184</p>
          <QrCode className="size-7 text-foreground" strokeWidth={1.75} />
        </div>
      </div>

      <div className={cn(floatingCard, "top-6.25 left-[calc(50%-525px)] z-3 hidden w-67.5 rotate-[-7deg] lg:flex")}>
        <div className="flex w-full items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Peserta hadir</p>
          <p className="font-mono text-xs text-muted-foreground">84/120</p>
        </div>
        <ul className="flex flex-col gap-2">
          {ATTENDEES.map((attendee) => (
            <li key={attendee.name} className="flex items-center gap-2 text-[13px]">
              {attendee.time ? (
                <CircleCheck className="size-4 text-green-700" strokeWidth={1.75} />
              ) : (
                <span className="size-4 rounded-full ring-1 ring-border ring-inset" />
              )}
              <span className={cn("flex-1", attendee.time ? "text-foreground" : "text-muted-foreground")}>{attendee.name}</span>
              <span className="font-mono text-[11px] text-muted-foreground">{attendee.time ?? "belum"}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="absolute top-0 left-[calc(50%-105px)] z-4 flex h-75 w-46.25 origin-top-left rotate-2 rounded-[30px] bg-[#1a1a1a] p-2 shadow-[0_16px_40px_-8px_rgb(0_0_0/0.12)] sm:h-85 sm:w-52.5">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-3xl bg-green-700 p-6 text-center text-white">
          <Check className="size-14" strokeWidth={2} />
          <p className="text-2xl/7 font-bold tracking-tight">Check-in berhasil</p>
          <p className="text-xs text-white/90">Rina Pratama · Reguler</p>
        </div>
      </div>

      <div className={cn(floatingCard, "top-13.75 left-[calc(50%+185px)] z-5 hidden w-62.5 rotate-[7deg] md:flex")}>
        <p className="text-sm font-semibold text-foreground">Workshop Desain UI Dasar</p>
        <p className="text-xs text-muted-foreground">12 Okt 2026 · 09.00 WIB · Aula FT</p>
        <div className="flex items-center gap-3 border-t border-border pt-3">
          <QrCode className="size-12 shrink-0 text-foreground" strokeWidth={1.5} />
          <div className="flex flex-col gap-0.5">
            <p className="text-[13px] font-semibold text-foreground">Rina Pratama</p>
            <p className="font-mono text-[11px] text-muted-foreground">HDR-7F2K-9QX1</p>
          </div>
        </div>
      </div>

      <div className={cn(floatingCard, "top-37.5 left-[calc(50%+525px)] z-6 hidden w-65 rotate-[-8deg] lg:flex")}>
        <div className="flex items-center gap-2.5">
          <FileCheck className="size-5 text-primary" strokeWidth={1.75} />
          <p className="text-sm font-semibold text-foreground">84 sertifikat terbit</p>
        </div>
        <p className="text-xs/5 text-muted-foreground">Hanya peserta yang check-in yang dapat sertifikat.</p>
      </div>
    </div>
  );
}

function MobileHeroVisual() {
  return (
    <div aria-hidden="true" className="relative mt-2 h-95 w-full overflow-hidden sm:hidden">
      <div className="absolute top-3.75 left-[calc(50%-74px)] z-0 flex h-82.5 w-42.5 origin-top-left rotate-3 rounded-[26px] bg-[#1a1a1a] p-1.75 shadow-[0_14px_32px_-8px_rgb(0_0_0/0.14)]">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-[20px] bg-green-600 p-5 text-center text-white">
          <Check className="size-12" strokeWidth={2} />
          <p className="text-[26px]/7.75 font-bold">VALID</p>
          <p className="text-xs text-white/80">Rina Pratama · Reguler</p>
        </div>
      </div>

      <div className={cn(floatingCard, "top-58.75 left-[calc(50%-219px)] z-1 w-57.5 gap-2 p-3.5 rotate-[8deg]")}>
        <p className="text-[9px]/3.25 font-bold tracking-[4px] text-muted-foreground">SERTIFIKAT</p>
        <p className={cn(certificateSerif.className, "text-2xl/7.5 font-semibold text-foreground")}>Rina Pratama</p>
        <p className="font-mono text-[10px]/3.5 text-muted-foreground">HDR/2026/X/0184</p>
      </div>

      <div className={cn(floatingCard, "top-71.25 left-[calc(50%+36px)] z-2 w-50 flex-row items-center gap-2 p-3 rotate-[-7deg]")}>
        <MailCheck className="size-4.5 shrink-0 text-primary" strokeWidth={1.75} />
        <p className="text-xs font-semibold text-foreground">84 sertifikat terkirim</p>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section aria-labelledby="hero-heading" className="overflow-hidden bg-muted">
      <div className="flex justify-center px-4 pt-8 sm:pt-10">
        <Link
          href="#template"
          className="inline-flex min-h-8 items-center gap-2 rounded-full bg-background px-3.5 text-xs font-medium text-foreground ring-1 ring-border transition-colors hover:bg-background/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Sparkles className="size-3.5 shrink-0 text-primary sm:hidden" strokeWidth={1.75} aria-hidden="true" />
          <span className="sm:hidden">Template sertifikat AI segera hadir</span>
          <span className="hidden sm:inline">Template sertifikat dengan AI segera hadir</span>
        </Link>
      </div>

      <HeroVisual />

      <Container className="flex max-w-240 flex-col items-center gap-4 pt-4 text-center sm:gap-5 sm:pb-20">
        <p className="text-xs/4.5 font-semibold sm:text-[13px] text-primary">Untuk panitia seminar, workshop, dan meetup</p>
        <h1
          id="hero-heading"
          className="text-4xl/10.5 font-bold tracking-[-0.9px] text-balance text-foreground sm:text-[56px]/16 sm:tracking-[-1.4px]"
        >
          Dari pendaftaran sampai sertifikat, semua di {APP_NAME}
        </h1>
        <p className="max-w-155 text-base/6.5 text-pretty sm:text-[17px]/7 text-neutral-600">
          Peserta daftar dari HP, kamu scan tiket di meja registrasi, dan sertifikat terbit otomatis untuk yang benar-benar
          hadir.
        </p>
        <div className="flex w-full flex-col justify-center gap-2.5 sm:w-auto sm:flex-row sm:gap-3">
          <Button nativeButton={false} render={<Link href={CREATE_EVENT_HREF} />} className="h-12 px-5 text-[15px] sm:h-11">
            Buat acara gratis
          </Button>
          <Button nativeButton={false} variant="outline" render={<Link href="#cara-kerja" />} className="h-12 px-5 text-[15px] sm:h-11">
            Lihat cara kerjanya
          </Button>
        </div>
        <p className="text-xs/4.5 text-neutral-600 sm:text-[13px]">Gratis untuk acara tanpa tiket berbayar. Masuk pakai akun Google.</p>
      </Container>

      <MobileHeroVisual />

      <Container className="flex max-w-300 flex-col items-center gap-7 pt-8 pb-16">
        <h2 className="text-[13px] font-semibold text-neutral-600">Yang biasanya bikin panitia kerja dua kali</h2>
        <ul className="grid w-full gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          {PROBLEMS.map((problem) => (
            <li key={problem} className="flex gap-2.5 text-[15px]/6 text-foreground">
              <X className="mt-0.5 size-4.5 shrink-0 text-neutral-500" strokeWidth={1.5} aria-hidden="true" />
              {problem}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

export { Hero };
