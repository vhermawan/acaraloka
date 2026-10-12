"use server";

import { revalidatePath } from "next/cache";

import { ACTION_FAILED, runAction, runLoggedAction } from "@/actions/_lib/handle-action-error";
import { normalizeTicketCode, type CheckInResult } from "@/lib/checkin";
import { requireEventOwner } from "@/server/authz";
import { checkIn, searchCheckInParticipants, undoCheckIn } from "@/server/checkin";

function revalidate(eventId: string) {
  revalidatePath(`/organizer/events/${eventId}/participants`);
  revalidatePath(`/organizer/events/${eventId}/checkin`);
}

export async function checkInByCode(eventId: string, rawCode: string): Promise<CheckInResult> {
  return runLoggedAction("action.checkInByCode", async () => {
    const { user, event } = await requireEventOwner(eventId);
    const ticketCode = normalizeTicketCode(rawCode);
    if (!ticketCode) return { outcome: "INVALID", participant: null };

    const result = await checkIn({ eventId: event.id, actorId: user.id, target: { ticketCode } });
    if (result.outcome === "VALID") revalidate(event.id);
    return result;
  });
}

export async function checkInByRegistration(eventId: string, registrationId: string): Promise<CheckInResult> {
  return runLoggedAction("action.checkInByRegistration", async () => {
    const { user, event } = await requireEventOwner(eventId);
    const result = await checkIn({ eventId: event.id, actorId: user.id, target: { registrationId } });
    if (result.outcome === "VALID") revalidate(event.id);
    return result;
  });
}

export async function undoParticipantCheckIn(eventId: string, registrationId: string): Promise<{ error?: string }> {
  return runAction("action.undoParticipantCheckIn", ACTION_FAILED, async () => {
    const { user, event } = await requireEventOwner(eventId);
    const ok = await undoCheckIn({ eventId: event.id, registrationId, actorId: user.id });
    if (!ok) return { error: "Check-in tidak bisa dibatalkan. Peserta belum check-in atau sertifikatnya sudah terbit." };

    revalidate(event.id);
    return {};
  });
}

export async function searchParticipants(eventId: string, query: string) {
  return runLoggedAction("action.searchParticipants", async () => {
    const { event } = await requireEventOwner(eventId);
    const trimmed = query.trim().slice(0, 100);
    if (trimmed.length < 2) return [];
    return searchCheckInParticipants(event.id, trimmed);
  });
}
