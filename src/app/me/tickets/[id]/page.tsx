import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Container } from "@/components/layout/container";
import { CancelRegistrationButton } from "@/components/tickets/cancel-registration-button";
import { RenameRegistrationForm } from "@/components/tickets/rename-registration-form";
import { TicketQr } from "@/components/tickets/ticket-qr";
import { TicketStateBadge } from "@/components/tickets/ticket-state-badge";
import { ticketState } from "@/lib/ticket-state";
import { formatEventDateTime } from "@/lib/timezone";
import { requireUser } from "@/server/authz";
import { getUserTicket } from "@/server/tickets";

export const metadata: Metadata = {
  title: "E-tiket",
  robots: { index: false },
};

export default async function TicketDetailPage({ params }: PageProps<"/me/tickets/[id]">) {
  const { id } = await params;
  const user = await requireUser({ next: `/me/tickets/${id}` });
  const ticket = await getUserTicket(user.id, id);
  if (!ticket) notFound();

  const { event } = ticket;
  const state = ticketState(ticket, event);
  const showQr = state === "ACTIVE" && !!ticket.ticketCode;

  return (
    <Container className="flex max-w-md flex-col gap-6 py-10">
      <Link href="/me/tickets" className="w-fit text-sm text-muted-foreground hover:text-foreground">
        Semua tiket
      </Link>

      {state === "EVENT_CANCELLED" ? (
        <div role="status" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">Acara dibatalkan</p>
          {event.cancelReason ? <p className="mt-1">{event.cancelReason}</p> : null}
        </div>
      ) : null}

      {state === "EVENT_DISABLED" ? (
        <div role="status" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">Acara dinonaktifkan</p>
          <p className="mt-1">Acara ini dinonaktifkan oleh admin. Tiket tidak bisa dipakai untuk check-in.</p>
        </div>
      ) : null}

      <article className="flex flex-col gap-6 rounded-xl border border-border p-5">
        <header className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-balance text-xl font-semibold tracking-tight">{event.title}</h1>
            <TicketStateBadge state={state} />
          </div>
          <p className="text-sm text-muted-foreground">{event.organizer.orgName}</p>
        </header>

        {showQr ? (
          <div className="flex flex-col items-center gap-3">
            <TicketQr code={ticket.ticketCode!} label={`QR e-tiket ${event.title}`} />
            <p className="text-center text-sm text-muted-foreground">
              Tunjukkan QR ini ke panitia saat check-in. Naikkan kecerahan layar agar mudah dipindai.
            </p>
            <p className="font-mono text-xs tracking-wider text-muted-foreground">{ticket.ticketCode}</p>
          </div>
        ) : (
          <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
            {state === "CHECKED_IN"
              ? "Kamu sudah check-in di acara ini."
              : state === "ENDED"
                ? "Acara sudah selesai."
                : "Tiket ini tidak berlaku lagi."}
          </p>
        )}

        <dl className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Nama</dt>
          <dd>{ticket.name}</dd>
          <dt className="text-muted-foreground">Tiket</dt>
          <dd>{ticket.ticketType.name}</dd>
          <dt className="text-muted-foreground">Mulai</dt>
          <dd>{formatEventDateTime(event.startAt, event.timezone)}</dd>
          <dt className="text-muted-foreground">Lokasi</dt>
          <dd className="break-words">{event.venue}</dd>
        </dl>
      </article>

      {ticket.status === "CONFIRMED" && !ticket.certificate ? (
        <RenameRegistrationForm key={ticket.name} registrationId={ticket.id} currentName={ticket.name} />
      ) : null}

      {state === "ACTIVE" ? <CancelRegistrationButton registrationId={ticket.id} /> : null}

      <Link href={`/e/${event.slug}`} className="w-fit text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
        Halaman acara
      </Link>
    </Container>
  );
}
