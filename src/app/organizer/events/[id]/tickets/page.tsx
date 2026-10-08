import type { Metadata } from "next";

import { DeleteTicketTypeButton } from "@/components/events/delete-ticket-type-button";
import { TicketTypeForm } from "@/components/events/ticket-type-form";
import { requireEventOwner } from "@/server/authz";
import { prisma } from "@/server/db";

import { createTicketType, updateTicketType } from "./actions";

export const metadata: Metadata = {
  title: "Tiket acara | Hadirly",
};

export default async function EventTicketsPage({ params }: PageProps<"/organizer/events/[id]/tickets">) {
  const { id } = await params;
  const { event } = await requireEventOwner(id);
  const editable = event.status === "DRAFT" || event.status === "PUBLISHED";
  const ticketTypes = await prisma.ticketType.findMany({
    where: { eventId: event.id },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="flex max-w-3xl flex-col gap-10">
      <section aria-labelledby="tickets-heading" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="tickets-heading" className="font-medium">Jenis tiket</h2>
          <p className="text-sm text-muted-foreground">
            Semua tiket gratis. Kuota tidak bisa dikurangi di bawah jumlah yang sudah dipesan.
          </p>
        </div>
        {ticketTypes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            Belum ada tiket. Acara butuh minimal satu jenis tiket sebelum bisa diterbitkan.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {ticketTypes.map((ticket) => (
              <li key={ticket.id} className="flex flex-col gap-2 p-4">
                <TicketTypeForm
                  key={ticket.updatedAt.toISOString()}
                  action={updateTicketType.bind(null, event.id, ticket.id)}
                  idPrefix={`ticket-${ticket.id}`}
                  defaultValues={{ name: ticket.name, quota: String(ticket.quota) }}
                  submitLabel="Simpan"
                  successMessage="Tiket diperbarui."
                  disabled={!editable}
                />
                <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                  <span className="tabular-nums">
                    {ticket.reservedCount} dari {ticket.quota} terpesan · Gratis
                  </span>
                  <DeleteTicketTypeButton eventId={event.id} ticketTypeId={ticket.id} disabled={!editable} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editable ? (
        <section aria-labelledby="new-ticket-heading" className="flex flex-col gap-4 border-t border-border pt-8">
          <h2 id="new-ticket-heading" className="font-medium">Tambah tiket</h2>
          <TicketTypeForm
            action={createTicketType.bind(null, event.id)}
            idPrefix="new-ticket"
            submitLabel="Tambah"
            successMessage="Tiket ditambahkan."
            resetOnSuccess
          />
        </section>
      ) : null}
    </div>
  );
}
