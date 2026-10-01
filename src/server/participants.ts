import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { PARTICIPANTS_PAGE_SIZE } from "@/lib/participants";
import { prisma } from "@/server/db";

export async function listParticipants(eventId: string, query: string, page: number) {
  const where: Prisma.RegistrationWhereInput = {
    eventId,
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, rows, counts] = await Promise.all([
    prisma.registration.count({ where }),
    prisma.registration.findMany({
      where,
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * PARTICIPANTS_PAGE_SIZE,
      take: PARTICIPANTS_PAGE_SIZE,
      include: { ticketType: { select: { name: true } } },
    }),
    prisma.registration.groupBy({
      by: ["status"],
      where: { eventId },
      _count: { _all: true },
    }),
  ]);
  const attended = await prisma.registration.count({ where: { eventId, status: "CONFIRMED", checkedInAt: { not: null } } });
  const confirmed = counts.find((row) => row.status === "CONFIRMED")?._count._all ?? 0;
  const cancelled = counts.find((row) => row.status === "CANCELLED")?._count._all ?? 0;

  return {
    rows,
    total,
    pageCount: Math.max(1, Math.ceil(total / PARTICIPANTS_PAGE_SIZE)),
    summary: { confirmed, attended, cancelled },
  };
}
