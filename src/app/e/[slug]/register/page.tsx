import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { RegistrationForm } from "@/components/events/registration-form";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { formatEventDateTime } from "@/lib/timezone";
import { requireUser } from "@/server/authz";
import { prisma } from "@/server/db";
import { getPublicEvent } from "@/server/public-event";
import { getRegistrationFields } from "@/server/registration-form";

import { registerForEvent } from "./actions";

export const metadata: Metadata = {
  title: "Daftar acara | event-in",
  robots: { index: false },
};

export default async function RegisterPage({ params }: PageProps<"/e/[slug]/register">) {
  const { slug } = await params;
  const user = await requireUser({ next: `/e/${slug}/register` });
  const event = await getPublicEvent(slug);
  if (!event) notFound();
  if (event.status !== "PUBLISHED" || event.endAt <= new Date()) redirect(`/e/${slug}`);

  const existing = await prisma.registration.findFirst({
    where: { eventId: event.id, userId: user.id, status: "CONFIRMED" },
    select: { id: true },
  });

  const fields = await getRegistrationFields(event.id);
  const tickets = event.ticketTypes.map((ticket) => ({
    id: ticket.id,
    name: ticket.name,
    left: Math.max(ticket.quota - ticket.reservedCount, 0),
  }));

  return (
    <Container className="flex max-w-xl flex-col gap-8 py-10">
      <header className="flex flex-col gap-1">
        <Link href={`/e/${slug}`} className="w-fit text-sm text-muted-foreground hover:text-foreground">
          Kembali ke halaman acara
        </Link>
        <h1 className="mt-2 text-balance text-2xl font-semibold tracking-tight">{event.title}</h1>
        <p className="text-sm text-muted-foreground">{formatEventDateTime(event.startAt, event.timezone)}</p>
      </header>
      {existing ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-4 text-sm">
          <p>Kamu sudah terdaftar di acara ini.</p>
          <Button className="w-fit" nativeButton={false} render={<Link href={`/me/tickets/${existing.id}`} />}>
            Lihat tiket
          </Button>
        </div>
      ) : (
        <RegistrationForm
          action={registerForEvent.bind(null, slug)}
          tickets={tickets}
          fields={fields}
          defaults={{ name: user.name, email: user.email, phone: user.phone ?? "" }}
        />
      )}
    </Container>
  );
}
