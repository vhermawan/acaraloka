import Link from "next/link";

import { EventNav } from "@/components/events/event-nav";
import { EventStatusBadge } from "@/components/events/event-status-badge";
import { Container } from "@/components/layout/container";
import { requireEventOwner } from "@/server/authz";

export default async function EventLayout({ children, params }: LayoutProps<"/organizer/events/[id]">) {
  const { id } = await params;
  const { event } = await requireEventOwner(id);

  return (
    <Container className="flex flex-col gap-8 py-12">
      <header className="flex flex-col gap-4">
        <Link href="/organizer" className="w-fit text-sm text-muted-foreground hover:text-foreground">
          Kembali ke daftar acara
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-balance text-2xl font-semibold tracking-tight">{event.title}</h1>
          <EventStatusBadge status={event.status} />
        </div>
        <EventNav eventId={event.id} />
      </header>
      {children}
    </Container>
  );
}
