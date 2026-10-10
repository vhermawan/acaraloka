import "server-only";

import { hasOnlineMeeting, meetingLinkForViewer } from "@/lib/event-location";
import { prisma } from "@/server/db";

export async function getMeetingLinkForUser(eventId: string, userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      status: true,
      locationType: true,
      onlineUrl: true,
      organizerId: true,
      registrations: { where: { userId, status: "CONFIRMED" }, select: { status: true }, take: 1 },
    },
  });
  if (!event || !hasOnlineMeeting(event.locationType)) return null;

  return meetingLinkForViewer(event, {
    isOrganizer: event.organizerId === userId,
    registrationStatus: event.registrations[0]?.status ?? null,
  });
}
