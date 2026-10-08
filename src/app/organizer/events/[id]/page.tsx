import type { Metadata } from "next";

import { cancelEventAction, updateEvent } from "@/app/organizer/events/actions";
import { CancelEventDialog } from "@/components/events/cancel-event-dialog";
import { DeleteEventButton } from "@/components/events/delete-event-button";
import { EventForm } from "@/components/events/event-form";
import { PosterUploader } from "@/components/events/poster-uploader";
import { PublicLinkRow } from "@/components/events/public-link-row";
import { PublishEventPanel } from "@/components/events/publish-event-panel";
import { ReadOnlyNotice } from "@/components/events/read-only-notice";
import { getPublishChecklist, isPubliclyVisible } from "@/lib/event-publish";
import { dateToLocalInput } from "@/lib/timezone";
import { requireEventOwner } from "@/server/authz";
import { prisma } from "@/server/db";
import { POSTER_BUCKET, publicObjectUrl } from "@/server/storage";

export const metadata: Metadata = {
  title: "Kelola acara",
};

function DangerAction({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-4 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex max-w-xl flex-col gap-1">
        <h2 id={id} className="text-lg/[26px] font-semibold">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </section>
  );
}

export default async function EditEventPage({ params }: PageProps<"/organizer/events/[id]">) {
  const { id } = await params;
  const { event } = await requireEventOwner(id);
  const editable = event.status === "DRAFT" || event.status === "PUBLISHED";
  const ticketTypeCount = await prisma.ticketType.count({ where: { eventId: event.id } });
  const cancellable = event.status === "PUBLISHED" && event.startAt > new Date();

  return (
    <div className="flex flex-col gap-8">
      {event.status === "DRAFT" ? (
        <PublishEventPanel eventId={event.id} checklist={getPublishChecklist({ ...event, ticketTypeCount })} />
      ) : null}
      {isPubliclyVisible(event.status) ? <PublicLinkRow path={`/e/${event.slug}`} /> : null}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-10">
        <section aria-labelledby="details-heading" className="flex min-w-0 flex-col gap-4">
          <h2 id="details-heading" className="text-lg/[26px] font-semibold">
            Detail acara
          </h2>
          {editable ? null : (
            <ReadOnlyNotice>Acara yang sudah dibatalkan atau dinonaktifkan tidak bisa diubah.</ReadOnlyNotice>
          )}
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
          <h2 id="poster-heading" className="text-lg/[26px] font-semibold">
            Poster
          </h2>
          <PosterUploader
            eventId={event.id}
            disabled={!editable}
            posterUrl={event.posterPath ? publicObjectUrl(POSTER_BUCKET, event.posterPath) : null}
          />
        </section>
      </div>

      {cancellable ? (
        <DangerAction
          id="cancel-heading"
          title="Batalkan acara"
          description="Hanya bisa sebelum acara dimulai. Peserta tidak bisa check-in setelah acara dibatalkan."
        >
          <CancelEventDialog title={event.title} action={cancelEventAction.bind(null, event.id)} />
        </DangerAction>
      ) : null}

      {event.status === "DRAFT" ? (
        <DangerAction
          id="delete-heading"
          title="Hapus draf"
          description="Hanya acara yang belum terbit yang bisa dihapus."
        >
          <DeleteEventButton eventId={event.id} title={event.title} />
        </DangerAction>
      ) : null}
    </div>
  );
}
