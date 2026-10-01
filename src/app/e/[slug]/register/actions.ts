"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { buildRegistrationSchema } from "@/lib/validation/registration";
import { canRegisterFreeTicket, requireUser } from "@/server/authz";
import { getPublicEvent } from "@/server/public-event";
import { createRegistration } from "@/server/registration";
import { getRegistrationFields } from "@/server/registration-form";

export type RegisterState = {
  errors?: Record<string, string[] | undefined>;
  message?: string;
  values?: Record<string, string>;
};

const REJECTION_MESSAGES = {
  ALREADY_REGISTERED: "Kamu sudah terdaftar di acara ini. Cek tiketmu di Tiket Saya.",
  SOLD_OUT: "Maaf, kuota tiket ini baru saja habis. Coba pilih jenis tiket lain jika masih ada.",
  CLOSED: "Pendaftaran acara ini sudah ditutup.",
} as const;

export async function registerForEvent(slug: string, _prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const user = await requireUser({ next: `/e/${slug}/register` });
  const values = Object.fromEntries(
    [...formData.entries()].filter(([key]) => !key.startsWith("$")).map(([key, value]) => [key, String(value)]),
  );

  if (!canRegisterFreeTicket(user)) {
    return { message: "Verifikasi email akunmu dulu sebelum mendaftar.", values };
  }

  const event = await getPublicEvent(slug);
  if (!event) return { message: REJECTION_MESSAGES.CLOSED, values };

  const fields = await getRegistrationFields(event.id);
  const schema = buildRegistrationSchema(
    fields,
    event.ticketTypes.map((ticket) => ticket.id),
  );
  const parsed = schema.safeParse(values);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values };

  const result = await createRegistration({ ...parsed.data, eventId: event.id, userId: user.id });
  if (!result.ok) return { message: REJECTION_MESSAGES[result.reason], values };

  revalidatePath(`/e/${slug}`);
  redirect(`/me/tickets/${result.registrationId}`);
}
