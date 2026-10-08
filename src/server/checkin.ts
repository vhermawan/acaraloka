import "server-only";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { isCheckInOpen, type CheckInParticipant, type CheckInResult } from "@/lib/checkin";
import { prisma } from "@/server/db";

type CheckInTarget = { ticketCode: string } | { registrationId: string };

function targetWhere(target: CheckInTarget): Prisma.RegistrationWhereInput {
  return "ticketCode" in target ? { ticketCode: target.ticketCode } : { id: target.registrationId };
}

function toParticipant(registration: {
  id: string;
  name: string;
  checkedInAt: Date | null;
  ticketType: { name: string };
}): CheckInParticipant {
  return {
    registrationId: registration.id,
    name: registration.name,
    ticketTypeName: registration.ticketType.name,
    checkedInAt: registration.checkedInAt?.toISOString() ?? null,
  };
}

const participantSelect = {
  id: true,
  eventId: true,
  name: true,
  status: true,
  checkedInAt: true,
  ticketType: { select: { name: true } },
} as const;

export async function checkIn(
  input: { eventId: string; actorId: string; target: CheckInTarget },
  db: PrismaClient = prisma,
  now = new Date(),
): Promise<CheckInResult> {
  const event = await db.event.findUnique({ where: { id: input.eventId }, select: { status: true } });
  if (!event || !isCheckInOpen(event.status)) return { outcome: "EVENT_CANCELLED", participant: null };

  const where = targetWhere(input.target);
  const updated = await db.registration.updateMany({
    where: { ...where, eventId: input.eventId, status: "CONFIRMED", checkedInAt: null },
    data: { checkedInAt: now, checkedInById: input.actorId },
  });

  const registration = await db.registration.findFirst({ where, select: participantSelect });
  if (!registration) return { outcome: "INVALID", participant: null };
  if (registration.eventId !== input.eventId) return { outcome: "WRONG_EVENT", participant: null };

  const participant = toParticipant(registration);
  if (updated.count === 1) return { outcome: "VALID", participant };
  if (registration.status === "CANCELLED") return { outcome: "CANCELLED", participant };
  if (registration.checkedInAt) return { outcome: "ALREADY_CHECKED_IN", participant };
  return { outcome: "INVALID", participant: null };
}

export async function undoCheckIn(
  input: { eventId: string; registrationId: string; actorId: string },
  db: PrismaClient = prisma,
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const registration = await tx.registration.findFirst({
      where: { id: input.registrationId, eventId: input.eventId },
      select: { checkedInAt: true, checkedInById: true },
    });
    if (!registration?.checkedInAt) return false;

    const reverted = await tx.registration.updateMany({
      where: {
        id: input.registrationId,
        eventId: input.eventId,
        status: "CONFIRMED",
        checkedInAt: { not: null },
        certificate: { is: null },
        event: { status: { not: "DISABLED" } },
      },
      data: { checkedInAt: null, checkedInById: null },
    });
    if (reverted.count === 0) return false;

    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        action: "checkin.undo",
        entityType: "Registration",
        entityId: input.registrationId,
        meta: {
          eventId: input.eventId,
          checkedInAt: registration.checkedInAt.toISOString(),
          checkedInById: registration.checkedInById,
        },
      },
    });
    return true;
  });
}

export const CHECK_IN_SEARCH_LIMIT = 10;

export async function searchCheckInParticipants(eventId: string, query: string, db: PrismaClient = prisma) {
  const rows = await db.registration.findMany({
    where: {
      eventId,
      status: "CONFIRMED",
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { phone: { contains: query } },
      ],
    },
    orderBy: { name: "asc" },
    take: CHECK_IN_SEARCH_LIMIT,
    select: { ...participantSelect, email: true },
  });
  return rows.map((row) => ({ ...toParticipant(row), email: row.email }));
}

export async function checkInSummary(eventId: string, db: PrismaClient = prisma) {
  const [registered, attended] = await Promise.all([
    db.registration.count({ where: { eventId, status: "CONFIRMED" } }),
    db.registration.count({ where: { eventId, status: "CONFIRMED", checkedInAt: { not: null } } }),
  ]);
  return { registered, attended };
}
