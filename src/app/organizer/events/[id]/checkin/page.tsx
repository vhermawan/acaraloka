import type { Metadata } from "next";
import Link from "next/link";
import { ScanLine } from "lucide-react";

import { CheckInConsole } from "@/components/checkin/checkin-console";
import { Button } from "@/components/ui/button";
import { isCheckInOpen } from "@/lib/checkin";
import { requireEventOwner } from "@/server/authz";
import { checkInSummary } from "@/server/checkin";

export const metadata: Metadata = {
  title: "Check-in",
};

const CLOSED_MESSAGES: Record<string, string> = {
  DRAFT: "Terbitkan acara dulu sebelum membuka check-in.",
  CANCELLED: "Acara ini dibatalkan. Tiket tidak bisa dipakai check-in.",
  DISABLED: "Acara ini dinonaktifkan admin. Check-in ditutup.",
};

export default async function CheckInPage({ params }: PageProps<"/organizer/events/[id]/checkin">) {
  const { id } = await params;
  const { event } = await requireEventOwner(id);

  if (!isCheckInOpen(event.status)) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center">
        <ScanLine className="size-7 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
        <p className="max-w-sm text-sm text-muted-foreground">{CLOSED_MESSAGES[event.status] ?? "Check-in ditutup."}</p>
        {event.status === "DRAFT" ? (
          <Button
            variant="outline"
            className="h-10 px-4"
            nativeButton={false}
            render={<Link href={`/organizer/events/${event.id}`} />}
          >
            Buka detail acara
          </Button>
        ) : null}
      </div>
    );
  }

  const summary = await checkInSummary(event.id);
  const percent = summary.registered > 0 ? Math.round((summary.attended / summary.registered) * 100) : 0;

  return (
    <div className="flex flex-col gap-8">
      <section aria-label="Kehadiran" className="flex flex-col gap-3">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-4xl/[44px] font-bold tabular-nums">{summary.attended}</span>
          <span className="text-muted-foreground tabular-nums">dari {summary.registered} peserta sudah hadir</span>
        </p>
        <div
          role="progressbar"
          aria-label="Peserta yang sudah hadir"
          aria-valuemin={0}
          aria-valuemax={summary.registered}
          aria-valuenow={summary.attended}
          className="h-2 max-w-xl overflow-hidden rounded-full bg-muted"
        >
          <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${percent}%` }} />
        </div>
      </section>
      <CheckInConsole eventId={event.id} timezone={event.timezone} />
    </div>
  );
}
