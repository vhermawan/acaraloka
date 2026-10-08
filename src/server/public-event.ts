import "server-only";
import { cache } from "react";

import { isPubliclyVisible, PUBLIC_EVENT_STATUSES } from "@/lib/event-publish";
import { prisma } from "@/server/db";

export const getPublicEvent = cache(async (slug: string) => {
  const event = await prisma.event.findUnique({
    where: { slug },
    include: {
      organizer: { select: { orgName: true, contactEmail: true, contactPhone: true } },
      ticketTypes: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!event || !isPubliclyVisible(event.status)) return null;
  return event;
});

export async function listSitemapEvents() {
  return prisma.event.findMany({
    where: { status: { in: [...PUBLIC_EVENT_STATUSES] } },
    select: { slug: true, updatedAt: true },
    orderBy: { startAt: "desc" },
  });
}
