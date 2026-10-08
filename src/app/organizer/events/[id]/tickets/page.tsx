import type { Metadata } from "next";
import { Tickets } from "lucide-react";

import { ConfirmActionButton } from "@/components/events/confirm-action-button";
import { ReadOnlyNotice } from "@/components/events/read-only-notice";
import { TicketTypeForm } from "@/components/events/ticket-type-form";
import { requireEventOwner } from "@/server/authz";
import { prisma } from "@/server/db";

import { createTicketType, deleteTicketType, updateTicketType } from "./actions";

export const metadata: Metadata = {
  title: "Tiket acara",
};

function QuotaBar({ reserved, quota }: { reserved: number; quota: number }) {
  const percent = quota > 0 ? Math.min(100, Math.round((reserved / quota) * 100)) : 0;
  const full = reserved >= quota;

  return (
    <div className="flex items-center gap-3">
      <div aria-hidden="true" className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
      <p className="shrink-0 text-sm text-muted-foreground tabular-nums">
        {reserved} dari {quota} terpesan · Gratis
        {full ? <span className="font-medium text-foreground"> · Habis</span> : null}
      </p>
    </div>
  );
}

export default async function EventTicketsPage({ params }: PageProps<"/organizer/events/[id]/tickets">) {
  const { id } = await params;
  const { event } = await requireEventOwner(id);
  const editable = event.status === "DRAFT" || event.status === "PUBLISHED";
  const ticketTypes = await prisma.ticketType.findMany({
    where: { eventId: event.id },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <section aria-labelledby="tickets-heading" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="tickets-heading" className="text-lg/[26px] font-semibold">
            Jenis tiket
          </h2>
          <p className="text-sm text-muted-foreground">
            Semua tiket gratis. Kuota tidak bisa dikurangi di bawah jumlah yang sudah dipesan.
          </p>
        </div>
        {editable ? null : <ReadOnlyNotice>Tiket acara yang sudah dibatalkan atau dinonaktifkan tidak bisa diubah.</ReadOnlyNotice>}
        {ticketTypes.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-10 text-center">
            <Tickets className="size-7 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
            <p className="max-w-sm text-sm text-muted-foreground">
              Belum ada tiket. Acara butuh minimal satu jenis tiket sebelum bisa diterbitkan.
            </p>
          </div>
        ) : (
          <div className="flex flex-col rounded-xl border border-border">
            <div
              aria-hidden="true"
              className="hidden grid-cols-[minmax(0,1fr)_7rem_9rem] gap-3 border-b border-border px-4 py-2.5 text-xs font-medium text-muted-foreground sm:grid"
            >
              <span>Nama tiket</span>
              <span>Kuota</span>
            </div>
            <ul className="flex flex-col divide-y divide-border">
              {ticketTypes.map((ticket) => (
                <li key={ticket.id} className="flex flex-col gap-3 p-4">
                  <TicketTypeForm
                    key={ticket.updatedAt.toISOString()}
                    action={updateTicketType.bind(null, event.id, ticket.id)}
                    idPrefix={`ticket-${ticket.id}`}
                    defaultValues={{ name: ticket.name, quota: String(ticket.quota) }}
                    submitLabel="Simpan"
                    successMessage="Tiket diperbarui."
                    disabled={!editable}
                    hideLabelsOnDesktop
                  >
                    <ConfirmActionButton
                      triggerLabel="Hapus"
                      triggerAriaLabel={`Hapus tiket ${ticket.name}`}
                      title={`Hapus tiket "${ticket.name}"?`}
                      description="Jenis tiket ini akan dihapus dari acara. Tiket yang sudah punya pendaftar tidak bisa dihapus."
                      confirmLabel="Hapus"
                      pendingLabel="Menghapus..."
                      successMessage="Tiket dihapus."
                      disabled={!editable}
                      action={deleteTicketType.bind(null, event.id, ticket.id)}
                    />
                  </TicketTypeForm>
                  <QuotaBar reserved={ticket.reservedCount} quota={ticket.quota} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {editable ? (
        <section aria-labelledby="new-ticket-heading" className="flex flex-col gap-4 border-t border-border pt-8">
          <h2 id="new-ticket-heading" className="text-lg/[26px] font-semibold">
            Tambah tiket
          </h2>
          <TicketTypeForm
            action={createTicketType.bind(null, event.id)}
            idPrefix="new-ticket"
            submitLabel="Tambah"
            successMessage="Tiket ditambahkan."
            submitVariant="default"
            resetOnSuccess
          />
        </section>
      ) : null}
    </div>
  );
}
