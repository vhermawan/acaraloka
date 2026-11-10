"use server";

import { revalidatePath } from "next/cache";

import { ACTION_ERROR_MESSAGE, ACTION_FAILED, runAction } from "@/actions/_lib/handle-action-error";
import { ticketTypeSchema } from "@/lib/validation/ticket";
import { hasPaymentSetup } from "@/lib/event-publish";
import { requireEventOwner } from "@/server/authz";
import { prisma } from "@/server/db";

export type TicketFormState = {
  errors?: Partial<Record<"name" | "quota" | "price", string[]>>;
  message?: string;
  values?: Record<string, string>;
  savedAt?: number;
};

const EDITABLE_STATUSES = new Set(["DRAFT", "PUBLISHED"]);

const PRICE_LOCKED = "Harga tidak bisa diubah karena tiket ini sudah punya pendaftar.";
const PAYMENT_SETUP_REQUIRED =
  "Acara sudah terbit. Isi instruksi pembayaran dan batas waktu bayar di detail acara sebelum membuat tiket berbayar.";

function readForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    quota: String(formData.get("quota") ?? ""),
    price: String(formData.get("price") ?? ""),
  };
}

export async function createTicketType(
  eventId: string,
  _prev: TicketFormState,
  formData: FormData,
): Promise<TicketFormState> {
  const values = readForm(formData);
  return runAction("action.createTicketType", { message: ACTION_ERROR_MESSAGE, values }, async () => {
    const { event } = await requireEventOwner(eventId);
    if (!EDITABLE_STATUSES.has(event.status)) return { message: "Tiket acara ini tidak bisa diubah.", values };

    const parsed = ticketTypeSchema.safeParse(values);
    if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values };

    if (parsed.data.price > 0 && event.status === "PUBLISHED" && !hasPaymentSetup(event)) {
      return { errors: { price: [PAYMENT_SETUP_REQUIRED] }, values };
    }

    await prisma.ticketType.create({ data: { ...parsed.data, eventId: event.id } });
    revalidatePath(`/organizer/events/${event.id}/tickets`);
    return { savedAt: Date.now() };
  });
}

export async function updateTicketType(
  eventId: string,
  ticketTypeId: string,
  _prev: TicketFormState,
  formData: FormData,
): Promise<TicketFormState> {
  const values = readForm(formData);
  return runAction("action.updateTicketType", { message: ACTION_ERROR_MESSAGE, values }, async () => {
    const { event } = await requireEventOwner(eventId);
    if (!EDITABLE_STATUSES.has(event.status)) return { message: "Tiket acara ini tidak bisa diubah.", values };

    const parsed = ticketTypeSchema.safeParse(values);
    if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values };

    const ticket = await prisma.ticketType.findFirst({ where: { id: ticketTypeId, eventId: event.id } });
    if (!ticket) return { message: "Tiket tidak ditemukan.", values };

    const priceChanged = parsed.data.price !== ticket.price;
    if (priceChanged) {
      if (ticket.reservedCount > 0 || (await prisma.registration.count({ where: { ticketTypeId: ticket.id } })) > 0) {
        return { errors: { price: [PRICE_LOCKED] }, values };
      }
      if (parsed.data.price > 0 && event.status === "PUBLISHED" && !hasPaymentSetup(event)) {
        return { errors: { price: [PAYMENT_SETUP_REQUIRED] }, values };
      }
    }

    const updated = await prisma.ticketType.updateMany({
      where: { id: ticket.id, reservedCount: priceChanged ? 0 : { lte: parsed.data.quota } },
      data: parsed.data,
    });
    if (updated.count === 0 && priceChanged) return { errors: { price: [PRICE_LOCKED] }, values };
    if (updated.count === 0) {
      return { errors: { quota: [`Kuota tidak boleh kurang dari ${ticket.reservedCount} tiket yang sudah dipesan.`] }, values };
    }

    revalidatePath(`/organizer/events/${event.id}/tickets`);
    return { values, savedAt: Date.now() };
  });
}

export async function deleteTicketType(eventId: string, ticketTypeId: string): Promise<{ error?: string }> {
  return runAction("action.deleteTicketType", ACTION_FAILED, async () => {
    const { event } = await requireEventOwner(eventId);
    if (!EDITABLE_STATUSES.has(event.status)) return { error: "Tiket acara ini tidak bisa diubah." };

    const registrations = await prisma.registration.count({ where: { ticketTypeId, eventId: event.id } });
    if (registrations > 0) return { error: "Tiket yang sudah punya pendaftar tidak bisa dihapus. Kurangi kuotanya saja." };

    await prisma.ticketType.deleteMany({ where: { id: ticketTypeId, eventId: event.id } });
    revalidatePath(`/organizer/events/${event.id}/tickets`);
    return {};
  });
}
