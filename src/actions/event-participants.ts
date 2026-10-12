"use server";

import { revalidatePath } from "next/cache";

import { ACTION_FAILED, runAction } from "@/actions/_lib/handle-action-error";
import { cancellationReasonSchema } from "@/lib/validation/cancellation";
import { requireEventOwner } from "@/server/authz";
import { cancelRegistration } from "@/server/cancellation";

export async function cancelParticipant(
  eventId: string,
  registrationId: string,
  reason: string,
): Promise<{ error?: string }> {
  return runAction("action.cancelParticipant", ACTION_FAILED, async () => {
    const { user, event } = await requireEventOwner(eventId);
    if (event.status === "DISABLED") return { error: "Acara ini dinonaktifkan admin." };
    const parsed = cancellationReasonSchema.safeParse(reason);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message };

    const result = await cancelRegistration({
      registrationId,
      eventId: event.id,
      actorId: user.id,
      reason: parsed.data || "Dibatalkan oleh panitia",
    });
    if (!result.ok) return { error: "Hanya peserta terdaftar yang belum check-in yang bisa dibatalkan." };

    revalidatePath(`/organizer/events/${event.id}/participants`);
    revalidatePath(`/e/${event.slug}`);
    return {};
  });
}
