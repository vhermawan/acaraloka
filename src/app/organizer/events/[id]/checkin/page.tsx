import type { Metadata } from "next";

import { CheckInConsole } from "@/components/checkin/checkin-console";
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
      <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        {CLOSED_MESSAGES[event.status] ?? "Check-in ditutup."}
      </p>
    );
  }

  const summary = await checkInSummary(event.id);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm">
        <span className="text-2xl font-semibold tabular-nums">{summary.attended}</span>
        <span className="text-muted-foreground tabular-nums"> dari {summary.registered} peserta sudah hadir</span>
      </p>
      <CheckInConsole eventId={event.id} timezone={event.timezone} />
    </div>
  );
}
