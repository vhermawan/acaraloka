import "server-only";
import { cache } from "react";

import { isPubliclyVisible } from "@/lib/event-publish";
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
