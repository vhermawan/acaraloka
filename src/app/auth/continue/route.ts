import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import {
  detectRoleConflict,
  loginPathFor,
  parseIntent,
  parseRole,
  resolvePostLoginPath,
} from "@/lib/roles";
import { hasAcceptedCurrentTerms } from "@/server/authz";
import { prisma } from "@/server/db";

export async function GET(request: NextRequest) {
  const intent = parseIntent(request.nextUrl.searchParams.get("intent"));
  const next = request.nextUrl.searchParams.get("next");
  const loginPath = loginPathFor(intent);

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect(loginPath);

  const { user } = session;
  if (user.disabledAt) {
    await auth.api.signOut({ headers: await headers() });
    redirect(`${loginPath}?error=disabled`);
  }

  const conflict = detectRoleConflict(parseRole(user.role), intent);
  if (conflict) {
    await auth.api.signOut({ headers: await headers() });
    redirect(`${loginPath}?error=${conflict}`);
  }

  const profile =
    intent === "ORGANIZER"
      ? await prisma.organizerProfile.findUnique({ where: { userId: user.id }, select: { userId: true } })
      : null;
  const destination = resolvePostLoginPath(intent, next, intent === "PARTICIPANT" || !!profile);

  if (!hasAcceptedCurrentTerms(user)) redirect(`/legal/accept?next=${encodeURIComponent(destination)}`);
  redirect(destination);
}
