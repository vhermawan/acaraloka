"use server";

import { revalidatePath } from "next/cache";

import { ticketTypeSchema } from "@/lib/validation/ticket";
import { requireEventOwner } from "@/server/authz";
import { prisma } from "@/server/db";

export type TicketFormState = {
  errors?: Partial<Record<"name" | "quota", string[]>>;
  message?: string;
  values?: Record<string, string>;
  savedAt?: number;
};

const EDITABLE_STATUSES = new Set(["DRAFT", "PUBLISHED"]);

function readForm(formData: FormData) {
  return { name: String(formData.get("name") ?? ""), quota: String(formData.get("quota") ?? "") };
}

export async function createTicketType(
  eventId: string,
  _prev: TicketFormState,
  formData: FormData,
): Promise<TicketFormState> {
  const { event } = await requireEventOwner(eventId);
  const values = readForm(formData);
  if (!EDITABLE_STATUSES.has(event.status)) return { message: "Tiket acara ini tidak bisa diubah.", values };

  const parsed = ticketTypeSchema.safeParse(values);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values };

  await prisma.ticketType.create({ data: { ...parsed.data, price: 0, eventId: event.id } });
  revalidatePath(`/organizer/events/${event.id}/tickets`);
  return { savedAt: Date.now() };
}

export async function updateTicketType(
  eventId: string,
  ticketTypeId: string,
  _prev: TicketFormState,
  formData: FormData,
): Promise<TicketFormState> {
  const { event } = await requireEventOwner(eventId);
  const values = readForm(formData);
  if (!EDITABLE_STATUSES.has(event.status)) return { message: "Tiket acara ini tidak bisa diubah.", values };

  const parsed = ticketTypeSchema.safeParse(values);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values };

  const ticket = await prisma.ticketType.findFirst({ where: { id: ticketTypeId, eventId: event.id } });
  if (!ticket) return { message: "Tiket tidak ditemukan.", values };

  const updated = await prisma.ticketType.updateMany({
    where: { id: ticket.id, reservedCount: { lte: parsed.data.quota } },
    data: parsed.data,
  });
  if (updated.count === 0) {
    return { errors: { quota: [`Kuota tidak boleh kurang dari ${ticket.reservedCount} tiket yang sudah dipesan.`] }, values };
  }

  revalidatePath(`/organizer/events/${event.id}/tickets`);
  return { values, savedAt: Date.now() };
}

export async function deleteTicketType(eventId: string, ticketTypeId: string): Promise<{ error?: string }> {
  const { event } = await requireEventOwner(eventId);
  if (!EDITABLE_STATUSES.has(event.status)) return { error: "Tiket acara ini tidak bisa diubah." };

  const registrations = await prisma.registration.count({ where: { ticketTypeId } });
  if (registrations > 0) return { error: "Tiket yang sudah punya pendaftar tidak bisa dihapus. Kurangi kuotanya saja." };

  await prisma.ticketType.deleteMany({ where: { id: ticketTypeId, eventId: event.id } });
  revalidatePath(`/organizer/events/${event.id}/tickets`);
  return {};
}
