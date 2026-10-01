import type { Metadata } from "next";

import { createEvent } from "@/app/organizer/events/actions";
import { EventForm } from "@/components/events/event-form";
import { Container } from "@/components/layout/container";
import { requireOrganizer } from "@/server/authz";

export const metadata: Metadata = {
  title: "Buat acara | event-in",
};

export default async function NewEventPage() {
  await requireOrganizer();

  return (
    <Container className="flex max-w-2xl flex-col gap-8 py-12">
      <header className="flex flex-col gap-1">
        <h1 className="text-balance text-2xl font-semibold tracking-tight">Buat acara</h1>
        <p className="text-sm text-muted-foreground">
          Acara disimpan sebagai draf. Poster, tiket, dan formulir bisa diatur setelahnya.
        </p>
      </header>
      <EventForm action={createEvent} submitLabel="Simpan draf" />
    </Container>
  );
}
