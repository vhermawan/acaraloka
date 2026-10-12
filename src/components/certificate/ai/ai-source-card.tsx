import Link from "next/link";
import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AI_QUOTA } from "@/lib/ai-config";
import type { AiAccess } from "@/server/ai-access";

type AiSourceCardProps = { eventId: string; access: AiAccess };

function AiSourceCard({ eventId, access }: AiSourceCardProps) {
  if (access.status === "HIDDEN") return null;

  const href = `/organizer/events/${eventId}/certificate/ai`;
  const available = access.status === "AVAILABLE";
  const locked = access.status === "LOCKED";

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 gap-3">
        <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={1.5} aria-hidden="true" />
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">Buat dengan AI</span>
            <Badge variant="outline">Beta</Badge>
            <span className="text-xs text-muted-foreground">Gratis selama beta</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {available
              ? `${access.remaining ?? AI_QUOTA.perEventKind} dari ${AI_QUOTA.perEventKind} percobaan tersisa untuk acara ini. Pilih gaya, AI membuat latarnya.`
              : access.message}
          </p>
        </div>
      </div>
      {locked ? (
        <Button type="button" variant="outline" className="h-10 w-fit shrink-0 px-4" disabled>
          Buat dengan AI
        </Button>
      ) : (
        <Button
          variant={available ? "default" : "outline"}
          className="h-10 w-fit shrink-0 px-4"
          nativeButton={false}
          render={<Link href={href} />}
        >
          {available ? "Buat dengan AI" : "Lihat hasil sebelumnya"}
        </Button>
      )}
    </div>
  );
}

export { AiSourceCard };
