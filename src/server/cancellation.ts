import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { eventCancelledEmail } from "@/lib/email-notifications";
import { prisma } from "@/server/db";
import { enqueueEmails } from "@/server/email-outbox";

export type CancelRegistrationResult = { ok: true } | { ok: false; reason: "NOT_CANCELLABLE" };

export async function cancelRegistration(
  input: { registrationId: string; eventId: string; actorId: string; reason: string | null },
  db: PrismaClient = prisma,
  now = new Date(),
): Promise<CancelRegistrationResult> {
  return db.$transaction(async (tx) => {
    const registration = await tx.registration.findFirst({
      where: { id: input.registrationId, eventId: input.eventId },
      select: { ticketTypeId: true },
    });
    if (!registration) return { ok: false, reason: "NOT_CANCELLABLE" };

    const cancelled = await tx.registration.updateMany({
      where: { id: input.registrationId, eventId: input.eventId, status: "CONFIRMED", checkedInAt: null },
      data: { status: "CANCELLED", cancelledAt: now, cancelReason: input.reason, cancelledById: input.actorId },
    });
    if (cancelled.count === 0) return { ok: false, reason: "NOT_CANCELLABLE" };

    await tx.$executeRaw`
      UPDATE "ticket_types"
      SET "reserved_count" = "reserved_count" - 1, "updated_at" = now()
      WHERE "id" = ${registration.ticketTypeId} AND "reserved_count" > 0
    `;
    return { ok: true };
  });
}

export async function cancelEvent(
  input: { eventId: string; reason: string },
  db: PrismaClient = prisma,
  now = new Date(),
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const updated = await tx.event.updateMany({
      where: { id: input.eventId, status: "PUBLISHED", startAt: { gt: now } },
      data: { status: "CANCELLED", cancelledAt: now, cancelReason: input.reason },
    });
    if (updated.count !== 1) return false;

    const event = await tx.event.findUniqueOrThrow({
      where: { id: input.eventId },
      select: {
        id: true,
        title: true,
        startAt: true,
        timezone: true,
        registrations: { where: { status: "CONFIRMED" }, select: { id: true, name: true, email: true } },
      },
    });
    await enqueueEmails(
      tx,
      event.registrations.map((registration) => eventCancelledEmail(registration, { ...event, reason: input.reason })),
    );
    return true;
  });
}
