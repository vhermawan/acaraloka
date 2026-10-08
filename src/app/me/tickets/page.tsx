import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { TicketStateBadge } from "@/components/tickets/ticket-state-badge";
import { Button } from "@/components/ui/button";
import { ticketState } from "@/lib/ticket-state";
import { formatEventDateTime } from "@/lib/timezone";
import { requireUser } from "@/server/authz";
import { listUserTickets } from "@/server/tickets";

export const metadata: Metadata = {
  title: "Tiket saya",
};

export default async function MyTicketsPage() {
  const user = await requireUser({ next: "/me/tickets" });
  const tickets = await listUserTickets(user.id);

  return (
    <Container className="flex max-w-2xl flex-col gap-8 py-12">
      <h1 className="text-balance text-2xl font-semibold tracking-tight">Tiket saya</h1>
      {tickets.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center">
          <h2 className="font-medium">Belum ada tiket</h2>
          <p className="text-sm text-muted-foreground">Tiket acara yang kamu daftari akan muncul di sini.</p>
          <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
            Ke beranda
          </Button>
        </section>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <Link
                href={`/me/tickets/${ticket.id}`}
                className="flex items-start justify-between gap-4 p-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="font-medium">{ticket.event.title}</span>
                  <span className="text-sm text-muted-foreground">
                    {formatEventDateTime(ticket.event.startAt, ticket.event.timezone)}
                  </span>
                  <span className="text-sm text-muted-foreground">{ticket.ticketType.name}</span>
                </div>
                <TicketStateBadge state={ticketState(ticket, ticket.event)} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
