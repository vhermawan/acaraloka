import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { AiWorkspace } from "@/components/certificate/ai/ai-workspace";
import { Button } from "@/components/ui/button";
import { AI_UNAVAILABLE_MESSAGE } from "@/lib/ai-config";
import { loadAiOverview } from "@/server/ai/overview";
import { requireEventOwner } from "@/server/authz";

export const maxDuration = 120;

export const metadata: Metadata = {
  title: "Sertifikat dengan AI",
};

export default async function AiCertificatePage({ params }: PageProps<"/organizer/events/[id]/certificate/ai">) {
  const { id } = await params;
  const { user, event } = await requireEventOwner(id);
  const overview = await loadAiOverview(user, event);
  const backHref = `/organizer/events/${event.id}/certificate`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Button variant="ghost" size="sm" className="-ml-2 h-9 w-fit gap-1.5" nativeButton={false} render={<Link href={backHref} />}>
          <ArrowLeft aria-hidden="true" />
          Kembali ke Sertifikat
        </Button>
        <h2 className="text-lg/7 font-semibold">Buat desain sertifikat dengan AI</h2>
      </div>

      {overview.access.status === "HIDDEN" ? (
        <p role="status" className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
          {AI_UNAVAILABLE_MESSAGE}
        </p>
      ) : (
        <AiWorkspace
          eventId={event.id}
          accessMessage={overview.access.status === "AVAILABLE" ? null : overview.access.message}
          formEnabled={overview.access.status === "AVAILABLE"}
          eventRemaining={overview.eventRemaining}
          dayRemaining={overview.dayRemaining}
          running={overview.running}
          failure={overview.failure}
          defaults={overview.defaults}
          results={overview.results}
          logos={overview.logos}
        />
      )}
    </div>
  );
}
