import Image from "next/image";
import Link from "next/link";

import { APP_NAME } from "@/lib/brand";

const FACTS = [
  "Peserta mendaftar sekali, e-tiket QR langsung ada di Tiket Saya.",
  "Panitia check-in dengan kamera HP, tanpa alat tambahan.",
  "Sertifikat bertanda tangan bisa dicek keasliannya lewat QR.",
];

function LoginShowcase() {
  return (
    <aside className="relative hidden overflow-hidden rounded-xl bg-[#e8f3f2] p-8 md:flex md:flex-col md:justify-between dark:bg-[#10202a]">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-28 -left-20 size-96 rounded-full bg-white/70 dark:bg-white/5" />
        <div className="absolute top-[12%] -right-14 size-52 rounded-full bg-[radial-gradient(circle_at_30%_30%,#b7e0de,#7cc7c4_45%,#0f5257)] opacity-90" />
        <div className="absolute -bottom-40 -right-24 size-104 rounded-full border-44 border-[#0f5257]/10 dark:border-[#7cc7c4]/10" />
        <div className="absolute top-[9%] right-40 size-3 rounded-full bg-accent-amber" />
      </div>

      <Link
        href="/"
        className="relative w-fit rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Image
          src="/logo/acaraloka-horizontal.svg"
          alt={APP_NAME}
          width={128}
          height={28}
          priority
          className="h-7 w-auto dark:hidden"
        />
        <Image
          src="/logo/acaraloka-horizontal-putih.svg"
          alt={APP_NAME}
          width={128}
          height={28}
          className="hidden h-7 w-auto dark:block"
        />
      </Link>

      <div className="relative flex flex-col gap-4">
        <h2 className="max-w-sm text-2xl/8 font-semibold tracking-tight text-[#10202a] dark:text-white">
          Dari pendaftaran sampai sertifikat, satu tempat untuk acaramu.
        </h2>
        <ul className="flex flex-col gap-2 rounded-lg border border-white/80 bg-white/60 p-4 text-sm/6 text-[#10202a]/80 backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:text-white/75">
          {FACTS.map((fact) => (
            <li key={fact} className="flex gap-2.5">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
              {fact}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

export { LoginShowcase };
