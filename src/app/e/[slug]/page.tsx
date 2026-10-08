import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatEventDateTime } from "@/lib/timezone";
import { getPublicEvent } from "@/server/public-event";
import { POSTER_BUCKET, publicObjectUrl } from "@/server/storage";

function excerpt(text: string, length = 160) {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > length ? `${flat.slice(0, length - 1)}…` : flat;
}

export async function generateMetadata({ params }: PageProps<"/e/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const event = await getPublicEvent(slug);
  if (!event) return { title: "Acara tidak ditemukan" };

  const description = excerpt(event.description);
  const images = event.posterPath ? [{ url: publicObjectUrl(POSTER_BUCKET, event.posterPath) }] : undefined;
  return {
    title: event.title,
    description,
    alternates: { canonical: `/e/${event.slug}` },
    openGraph: { type: "website", title: event.title, description, url: `/e/${event.slug}`, images },
    twitter: { card: images ? "summary_large_image" : "summary", title: event.title, description },
  };
}

export default async function PublicEventPage({ params }: PageProps<"/e/[slug]">) {
  const { slug } = await params;
  const event = await getPublicEvent(slug);
  if (!event) notFound();

  const cancelled = event.status === "CANCELLED";
  const ended = event.endAt <= new Date();
  const remaining = event.ticketTypes.reduce((sum, ticket) => sum + Math.max(ticket.quota - ticket.reservedCount, 0), 0);
  const registrationOpen = !cancelled && !ended && remaining > 0;
  const posterUrl = event.posterPath ? publicObjectUrl(POSTER_BUCKET, event.posterPath) : null;

  return (
    <Container className="py-10">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <article className="flex min-w-0 flex-col gap-6">
          {cancelled ? (
            <div role="status" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
              <p className="font-medium text-destructive">Acara dibatalkan</p>
              {event.cancelReason ? <p className="mt-1 text-foreground">{event.cancelReason}</p> : null}
            </div>
          ) : null}
          {posterUrl ? (
            <Image
              src={posterUrl}
              alt={`Poster ${event.title}`}
              width={800}
              height={1000}
              unoptimized
              priority
              className="w-full max-w-md rounded-lg border border-border object-cover"
            />
          ) : null}
          <header className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">{event.organizer.orgName}</p>
            <h1 className="text-balance text-3xl font-semibold tracking-tight">{event.title}</h1>
          </header>
          <dl className="grid gap-3 text-sm sm:grid-cols-[6rem_minmax(0,1fr)]">
            <dt className="text-muted-foreground">Mulai</dt>
            <dd>{formatEventDateTime(event.startAt, event.timezone)}</dd>
            <dt className="text-muted-foreground">Selesai</dt>
            <dd>{formatEventDateTime(event.endAt, event.timezone)}</dd>
            <dt className="text-muted-foreground">Lokasi</dt>
            <dd className="break-words">{event.venue}</dd>
          </dl>
          <div className="text-pretty text-sm leading-relaxed whitespace-pre-line">{event.description}</div>
        </article>

        <aside className="flex h-fit flex-col gap-4 rounded-lg border border-border p-4 lg:sticky lg:top-6">
          <h2 className="font-medium">Tiket</h2>
          <ul className="flex flex-col gap-3">
            {event.ticketTypes.map((ticket) => {
              const left = Math.max(ticket.quota - ticket.reservedCount, 0);
              return (
                <li key={ticket.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex flex-col">
                    <span className="font-medium">{ticket.name}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {left > 0 ? `Sisa ${left.toLocaleString("id-ID")}` : "Habis"}
                    </span>
                  </div>
                  <Badge variant="secondary">Gratis</Badge>
                </li>
              );
            })}
          </ul>
          {registrationOpen ? (
            <Button size="lg" nativeButton={false} render={<Link href={`/e/${event.slug}/register`} />}>
              Daftar
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              {cancelled ? "Pendaftaran ditutup." : ended ? "Acara sudah selesai." : "Kuota sudah habis."}
            </p>
          )}
        </aside>
      </div>
    </Container>
  );
}
