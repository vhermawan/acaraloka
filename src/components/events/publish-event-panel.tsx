"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Circle, CircleCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";

import { publishEvent } from "@/app/organizer/events/actions";
import { Button } from "@/components/ui/button";
import type { PublishRequirement } from "@/lib/event-publish";

type PublishEventPanelProps = {
  eventId: string;
  checklist: PublishRequirement[];
};

function PublishEventPanel({ eventId, checklist }: PublishEventPanelProps) {
  const [pending, startTransition] = useTransition();
  const ready = checklist.every((item) => item.met);
  const needsTickets = checklist.some((item) => item.key === "tickets" && !item.met);

  return (
    <section
      aria-labelledby="publish-heading"
      className="flex flex-col gap-4 rounded-xl border border-primary/30 bg-primary/[0.03] p-5"
    >
      <div className="flex flex-col gap-1">
        <h2 id="publish-heading" className="text-lg/[26px] font-semibold">
          Terbitkan acara
        </h2>
        <p className="text-sm text-muted-foreground">
          Setelah terbit, halaman acara bisa dibuka publik dan pendaftaran dibuka.
        </p>
      </div>
      <ul className="flex flex-col gap-2 text-sm">
        {checklist.map((item) => (
          <li key={item.key} className="flex items-start gap-2.5">
            {item.met ? (
              <CircleCheck className="mt-px size-[18px] shrink-0 text-success" strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <Circle className="mt-px size-[18px] shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
            )}
            <span className={cn(item.met ? "text-muted-foreground" : "text-foreground")}>
              <span className="sr-only">{item.met ? "Terpenuhi: " : "Belum terpenuhi: "}</span>
              {item.label}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button
          className="h-10 px-4"
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
        {needsTickets ? (
          <Button
            variant="outline"
            className="h-10 px-4"
            nativeButton={false}
            render={<Link href={`/organizer/events/${eventId}/tickets`} />}
          >
            Atur tiket
          </Button>
        ) : null}
      </div>
    </section>
  );
}

export { PublishEventPanel };
