import { ExternalLink, TriangleAlert } from "lucide-react";

import { EventBreadcrumb } from "@/components/events/event-breadcrumb";
import { EventStatusBadge } from "@/components/events/event-status-badge";
import { Button } from "@/components/ui/button";
import { LEGAL_OPERATOR } from "@/lib/legal";
import { formatEventSchedule } from "@/lib/timezone";
import { requireEventOwner } from "@/server/authz";

export default async function EventLayout({ children, params }: LayoutProps<"/organizer/events/[id]">) {
  const { id } = await params;
  const { event } = await requireEventOwner(id);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 border-b border-border pb-6">
        <EventBreadcrumb eventId={event.id} title={event.title} />
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
              <h1 className="text-2xl/8 font-bold tracking-tight text-balance break-words">{event.title}</h1>
              <EventStatusBadge status={event.status} />
            </div>
            {event.status === "PUBLISHED" ? (
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<a href={`/e/${event.slug}`} target="_blank" rel="noopener" />}
                className="h-9 gap-1.5"
              >
                <ExternalLink aria-hidden="true" />
                Lihat halaman publik
                <span className="sr-only">(tab baru)</span>
              </Button>
            ) : null}
          </div>
          <p className="text-sm break-words text-muted-foreground">
            <span className="tabular-nums">{formatEventSchedule(event.startAt, event.timezone)}</span>
            <span aria-hidden="true"> · </span>
            {event.venue}
          </p>
        </div>
      </header>
      {event.status === "DISABLED" ? (
        <div role="alert" className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-destructive" strokeWidth={1.5} aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-medium text-destructive">Acara ini dinonaktifkan admin</p>
            <p className="mt-1 break-words">{event.disabledReason ?? "Tidak ada alasan yang dicatat."}</p>
            <p className="mt-2 text-muted-foreground">
              Halaman publik, pendaftaran, check-in, dan penerbitan sertifikat ditutup. Sertifikat yang sudah terbit
              tetap berlaku. Hubungi admin di {LEGAL_OPERATOR.email} untuk mengaktifkan kembali.
            </p>
          </div>
        </div>
      ) : null}
      {children}
    </div>
  );
}
