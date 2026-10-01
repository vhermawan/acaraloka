"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";

import { publishEvent } from "@/app/organizer/events/actions";
import { Button } from "@/components/ui/button";

type PublishEventPanelProps = {
  eventId: string;
  issues: string[];
};

function PublishEventPanel({ eventId, issues }: PublishEventPanelProps) {
  const [pending, startTransition] = useTransition();
  const ready = issues.length === 0;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-medium">Terbitkan acara</h2>
        <p className="text-sm text-muted-foreground">
          Setelah terbit, halaman acara bisa dibuka publik dan pendaftaran dibuka.
        </p>
      </div>
      {ready ? null : (
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!ready || pending}
          onClick={() =>
            startTransition(async () => {
              const result = await publishEvent(eventId);
              if (result.error) toast.error(result.error);
              else toast.success("Acara diterbitkan.");
            })
          }
        >
          {pending ? "Menerbitkan..." : "Terbitkan"}
        </Button>
        {ready ? null : (
          <Button variant="outline" nativeButton={false} render={<Link href={`/organizer/events/${eventId}/tickets`} />}>
            Atur tiket
          </Button>
        )}
      </div>
    </div>
  );
}

export { PublishEventPanel };
