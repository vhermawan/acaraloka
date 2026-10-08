import type { Metadata } from "next";

import { createEvent } from "@/app/organizer/events/actions";
import { EventForm } from "@/components/events/event-form";
import { requireOrganizer } from "@/server/authz";

export const metadata: Metadata = {
  title: "Buat acara",
};

export default async function NewEventPage() {
  await requireOrganizer();

  return (
    <div className="flex max-w-[640px] flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-balance text-2xl/8 font-bold tracking-tight">Buat acara</h1>
        <p className="text-sm text-muted-foreground">
          Acara disimpan sebagai draf. Poster, tiket, dan formulir bisa diatur setelahnya.
        </p>
      </header>
      <EventForm action={createEvent} submitLabel="Simpan draf" />
    </div>
  );
}
