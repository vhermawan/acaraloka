import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { JoinOrganizerForm } from "@/components/organizer/join-organizer-form";
import { APP_NAME } from "@/lib/brand";
import { requireUser } from "@/server/authz";
import { prisma } from "@/server/db";

export const metadata: Metadata = {
  title: "Jadi panitia",
};

export default async function JoinOrganizerPage() {
  const user = await requireUser();
  const existing = await prisma.organizerProfile.findUnique({
    where: { userId: user.id },
  });
  if (existing) redirect("/organizer");

  return (
    <div className="flex min-h-dvh flex-col items-center bg-sidebar px-4 py-10 sm:justify-center sm:py-16">
      <div className="flex w-full max-w-[440px] flex-col gap-6">
        <Link
          href="/"
          className="w-fit self-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Image src="/logo/acaraloka-horizontal.svg" alt={APP_NAME} width={144} height={32} priority className="h-8 w-auto" />
        </Link>
        <section
          aria-labelledby="join-heading"
          className="flex flex-col gap-6 rounded-xl border border-border bg-card p-6 sm:p-8"
        >
          <div className="flex flex-col gap-1.5">
            <h1 id="join-heading" className="text-2xl/8 font-bold tracking-tight">
              Jadi panitia
            </h1>
            <p className="text-sm text-muted-foreground">
              Isi data penyelenggara untuk mulai membuat acara. Kontak ini bisa dilihat peserta yang mendaftar.
            </p>
          </div>
          <JoinOrganizerForm defaultEmail={user.email} />
        </section>
        <p className="text-center text-sm text-muted-foreground">
          Masuk sebagai <span className="font-medium text-foreground">{user.email}</span>
        </p>
      </div>
    </div>
  );
}
