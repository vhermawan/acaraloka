import "server-only";

import { prisma } from "@/server/db";

const eventSelect = {
  id: true,
  slug: true,
  title: true,
  startAt: true,
  endAt: true,
  timezone: true,
  venue: true,
  status: true,
  cancelReason: true,
} as const;

export async function listUserTickets(userId: string) {
  return prisma.registration.findMany({
    where: { userId },
    orderBy: { event: { startAt: "desc" } },
    include: { event: { select: eventSelect }, ticketType: { select: { name: true } } },
  });
}

export async function getUserTicket(userId: string, registrationId: string) {
  return prisma.registration.findFirst({
    where: { id: registrationId, userId },
    include: {
      event: { select: { ...eventSelect, organizer: { select: { orgName: true, contactPhone: true, contactEmail: true } } } },
      ticketType: { select: { name: true } },
    },
  });
}
