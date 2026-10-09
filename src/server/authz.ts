import "server-only";
import { notFound, redirect } from "next/navigation";

import { TERMS_VERSION } from "@/lib/legal";
import { homePathFor, loginPathFor, parseRole } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { prisma } from "@/server/db";

type SessionUser = NonNullable<Awaited<ReturnType<typeof getSession>>>["user"];

export function hasAcceptedCurrentTerms(user: Pick<SessionUser, "termsVersion" | "termsAcceptedAt">) {
  return !!user.termsAcceptedAt && user.termsVersion === TERMS_VERSION;
}

export function canRegisterFreeTicket(user: Pick<SessionUser, "emailVerified">) {
  return user.emailVerified === true;
}

function withNext(path: string, next?: string) {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}

export async function requireUser(options: { next?: string; loginPath?: string } = {}) {
  const loginPath = options.loginPath ?? "/login";
  const session = await getSession();
  if (!session) redirect(withNext(loginPath, options.next));

  const { user } = session;
  if (user.disabledAt) redirect(`${loginPath}?error=disabled`);
  if (!hasAcceptedCurrentTerms(user)) redirect(withNext("/legal/accept", options.next));

  return user;
}

export async function requireParticipant(options: { next?: string } = {}) {
  const user = await requireUser(options);
  if (parseRole(user.role) === "ORGANIZER") redirect(homePathFor("ORGANIZER"));

  return user;
}

export async function requireOrganizer() {
  const user = await requireUser({ loginPath: loginPathFor("ORGANIZER") });
  if (parseRole(user.role) !== "ORGANIZER") redirect(`${loginPathFor("ORGANIZER")}?error=role-participant`);

  const organizer = await prisma.organizerProfile.findUnique({
    where: { userId: user.id },
  });
  if (!organizer) redirect("/organizer/register");

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
