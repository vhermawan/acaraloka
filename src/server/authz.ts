import "server-only";
import { notFound, redirect } from "next/navigation";

import { TERMS_VERSION } from "@/lib/legal";
import { getSession } from "@/lib/session";
import { prisma } from "@/server/db";

type SessionUser = NonNullable<Awaited<ReturnType<typeof getSession>>>["user"];

export function hasAcceptedCurrentTerms(user: Pick<SessionUser, "termsVersion" | "termsAcceptedAt">) {
  return !!user.termsAcceptedAt && user.termsVersion === TERMS_VERSION;
}

export function canRegisterFreeTicket(user: Pick<SessionUser, "emailVerified">) {
  return user.emailVerified === true;
}

export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");

  const { user } = session;
  if (user.disabledAt) redirect("/login?error=disabled");
  if (!hasAcceptedCurrentTerms(user)) redirect("/legal/accept");

  return user;
}

export async function requireOrganizer() {
  const user = await requireUser();
  const organizer = await prisma.organizerProfile.findUnique({
    where: { userId: user.id },
  });
  if (!organizer) redirect("/organizer/join");

  return { user, organizer };
}

export async function requireEventOwner(eventId: string) {
  const { user, organizer } = await requireOrganizer();
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || event.organizerId !== user.id) notFound();

  return { user, organizer, event };
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.isAdmin !== true) notFound();

  return user;
}
