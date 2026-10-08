"use server";

import { revalidatePath } from "next/cache";

import { disableReasonSchema } from "@/lib/validation/event-disable";
import { requireAdmin } from "@/server/authz";
import { disableEvent, enableEvent } from "@/server/admin-events";

export type DisableEventState = {
  error?: string;
  done?: boolean;
  values?: { reason: string };
};

function revalidateEvent(eventId: string, slug: string) {
  revalidatePath("/admin/events");
  revalidatePath("/admin");
  revalidatePath(`/organizer/events/${eventId}`, "layout");
  revalidatePath(`/e/${slug}`);
  revalidatePath("/me/tickets", "layout");
}

export async function disableEventAction(
  eventId: string,
  _prev: DisableEventState,
  formData: FormData,
): Promise<DisableEventState> {
  const admin = await requireAdmin();
  const values = { reason: String(formData.get("reason") ?? "") };
  const parsed = disableReasonSchema.safeParse(values.reason);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, values };

  const result = await disableEvent({ eventId, actorId: admin.id, reason: parsed.data });
  if (!result.ok) {
    return {
      error: result.reason === "NOT_FOUND" ? "Acara tidak ditemukan." : "Acara ini sudah dinonaktifkan.",
      values,
    };
  }

  revalidateEvent(eventId, result.slug);
  return { done: true };
}

export async function enableEventAction(eventId: string): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  const result = await enableEvent({ eventId, actorId: admin.id });
  if (!result.ok) {
    return { error: result.reason === "NOT_FOUND" ? "Acara tidak ditemukan." : "Acara ini tidak sedang dinonaktifkan." };
  }

  revalidateEvent(eventId, result.slug);
  return {};
}
