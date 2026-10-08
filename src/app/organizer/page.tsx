import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { CalendarPlus, ChevronRight, ImageIcon, Plus } from "lucide-react";

import { EventStatusBadge } from "@/components/events/event-status-badge";
import { Button } from "@/components/ui/button";
import { splitEventsByStart } from "@/lib/event-groups";
import { formatEventSchedule } from "@/lib/timezone";
import { requireOrganizer } from "@/server/authz";
import { prisma } from "@/server/db";
import { POSTER_BUCKET, publicObjectUrl } from "@/server/storage";

export const metadata: Metadata = {
  title: "Dashboard panitia",
};

type EventRow = {
  id: string;
  title: string;
  status: "DRAFT" | "PUBLISHED" | "CANCELLED" | "DISABLED";
  startAt: Date;
  timezone: string;
  posterPath: string | null;
};

function CreateEventButton() {
  return (
    <Button nativeButton={false} render={<Link href="/organizer/events/new" />} className="h-10 gap-2 px-4">
      <Plus className="size-4" aria-hidden="true" />
      Buat acara
    </Button>
  );
}

function EventThumbnail({ posterPath }: { posterPath: string | null }) {
  if (!posterPath) {
    return (
      <span className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <ImageIcon className="size-5" strokeWidth={1.5} aria-hidden="true" />
      </span>
    );
  }
  return (
    <Image
      src={publicObjectUrl(POSTER_BUCKET, posterPath)}
      alt=""
      width={64}
      height={64}
      unoptimized
      className="size-16 shrink-0 rounded-lg border border-border object-cover"
    />
  );
}

function EventGroup({ title, events }: { title: string; events: EventRow[] }) {
  if (events.length === 0) return null;
  const headingId = `group-${title.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="text-lg/[26px] font-semibold">
        {title}
      </h2>
      <ul className="flex flex-col gap-2">
        {events.map((event) => (
          <li key={event.id}>
            <Link
              href={`/organizer/events/${event.id}`}
              className="group flex items-center gap-4 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/30 hover:bg-primary/[0.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <EventThumbnail posterPath={event.posterPath} />
              <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="flex min-w-0 max-w-full flex-col gap-0.5">
                  <p className="truncate text-base font-semibold">{event.title}</p>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {formatEventSchedule(event.startAt, event.timezone)}
                  </p>
                </div>
                <EventStatusBadge status={event.status} />
              </div>
              <ChevronRight
                className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                strokeWidth={1.5}
                aria-hidden="true"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function EventList({ organizerId }: { organizerId: string }) {
  const events = await prisma.event.findMany({
    where: { organizerId },
    select: { id: true, title: true, status: true, startAt: true, timezone: true, posterPath: true },
  });

  if (events.length === 0) {
    return (
      <section className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border px-6 py-14 text-center">
        <CalendarPlus className="size-8 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold">Belum ada acara</h2>
          <p className="text-sm text-muted-foreground">Acara yang kamu buat akan muncul di sini.</p>
        </div>
        <CreateEventButton />
      </section>
    );
  }

  const { upcoming, past } = splitEventsByStart(events);

  return (
    <div className="flex flex-col gap-8">
      <EventGroup title="Akan datang" events={upcoming} />
      <EventGroup title="Sudah lewat" events={past} />
    </div>
  );
}

function EventListSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-3">
      <span className="sr-only">Memuat daftar acara</span>
      <div className="h-6 w-32 rounded-md bg-muted" />
      {[0, 1, 2].map((item) => (
        <div key={item} className="flex items-center gap-4 rounded-xl border border-border p-3">
          <div className="size-16 shrink-0 rounded-lg bg-muted motion-safe:animate-pulse" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-4 w-2/3 max-w-72 rounded bg-muted motion-safe:animate-pulse" />
            <div className="h-3.5 w-1/2 max-w-52 rounded bg-muted motion-safe:animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function OrganizerDashboardPage() {
  const { user, organizer } = await requireOrganizer();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="truncate text-sm text-muted-foreground">{organizer.orgName}</p>
          <h1 className="text-2xl/8 font-bold tracking-tight">Acara kamu</h1>
        </div>
        <CreateEventButton />
      </header>
      <Suspense fallback={<EventListSkeleton />}>
        <EventList organizerId={user.id} />
      </Suspense>
    </div>
  );
}
