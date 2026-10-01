"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/server/authz";
import { cancelRegistration } from "@/server/cancellation";
import { prisma } from "@/server/db";

export async function cancelMyRegistration(registrationId: string): Promise<{ error?: string }> {
  const user = await requireUser();
  const registration = await prisma.registration.findFirst({
    where: { id: registrationId, userId: user.id },
    select: { eventId: true, event: { select: { slug: true, endAt: true, status: true } } },
  });
  if (!registration || registration.event.status !== "PUBLISHED" || registration.event.endAt <= new Date()) {
    return { error: "Pendaftaran ini tidak bisa dibatalkan." };
  }

  const result = await cancelRegistration({
    registrationId,
    eventId: registration.eventId,
    actorId: user.id,
    reason: "Dibatalkan oleh peserta",
  });
  if (!result.ok) return { error: "Pendaftaran ini tidak bisa dibatalkan. Tiket yang sudah check-in tidak bisa dibatalkan." };

  revalidatePath(`/me/tickets/${registrationId}`);
  revalidatePath("/me/tickets");
  revalidatePath(`/e/${registration.event.slug}`);
  return {};
}
