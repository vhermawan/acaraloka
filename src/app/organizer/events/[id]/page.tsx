import type { Metadata } from "next";

import { updateEvent } from "@/app/organizer/events/actions";
import { DeleteEventButton } from "@/components/events/delete-event-button";
import { EventForm } from "@/components/events/event-form";
import { PosterUploader } from "@/components/events/poster-uploader";
import { dateToLocalInput } from "@/lib/timezone";
import { requireEventOwner } from "@/server/authz";
import { POSTER_BUCKET, publicObjectUrl } from "@/server/storage";

export const metadata: Metadata = {
  title: "Kelola acara | event-in",
};

export default async function EditEventPage({ params }: PageProps<"/organizer/events/[id]">) {
  const { id } = await params;
  const { event } = await requireEventOwner(id);
  const editable = event.status === "DRAFT" || event.status === "PUBLISHED";

  return (
    <div className="flex flex-col gap-10">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <section aria-labelledby="details-heading" className="flex flex-col gap-4">
          <h2 id="details-heading" className="font-medium">Detail acara</h2>
          <EventForm
            action={updateEvent.bind(null, event.id)}
            submitLabel="Simpan perubahan"
            disabled={!editable}
            defaultValues={{
              title: event.title,
              description: event.description,
              timezone: event.timezone,
              startAt: dateToLocalInput(event.startAt, event.timezone),
              endAt: dateToLocalInput(event.endAt, event.timezone),
              venue: event.venue,
            }}
          />
        </section>
        <section aria-labelledby="poster-heading" className="flex flex-col gap-4">
          <h2 id="poster-heading" className="font-medium">Poster</h2>
          <PosterUploader
            eventId={event.id}
            disabled={!editable}
            posterUrl={event.posterPath ? publicObjectUrl(POSTER_BUCKET, event.posterPath) : null}
          />
        </section>
      </div>

      {event.status === "DRAFT" ? (
        <section aria-labelledby="danger-heading" className="flex flex-col gap-3 border-t border-border pt-8">
          <h2 id="danger-heading" className="font-medium">Hapus draf</h2>
          <p className="text-sm text-muted-foreground">Hanya acara yang belum terbit yang bisa dihapus.</p>
          <div>
            <DeleteEventButton eventId={event.id} title={event.title} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
