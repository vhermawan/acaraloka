import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthScreen } from "@/components/auth/auth-screen";
import { parseRole, parseRoleConflict, resolvePostLoginPath } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { prisma } from "@/server/db";

export const metadata: Metadata = {
  title: "Masuk sebagai panitia",
};

export default async function OrganizerLoginPage({ searchParams }: PageProps<"/organizer/login">) {
  const { next, error } = await searchParams;

  const session = await getSession();
  const sessionRole = session ? parseRole(session.user.role) : null;
  if (session && !session.user.disabledAt && sessionRole === "ORGANIZER") {
    const profile = await prisma.organizerProfile.findUnique({
      where: { userId: session.user.id },
      select: { userId: true },
    });
    redirect(resolvePostLoginPath("ORGANIZER", next, !!profile));
  }

  return (
    <AuthScreen
      role="ORGANIZER"
      mode="login"
      path="/organizer/login"
      next={resolvePostLoginPath("ORGANIZER", next, true)}
      conflict={sessionRole === "PARTICIPANT" ? "role-participant" : parseRoleConflict(error)}
      disabled={error === "disabled"}
    />
  );
}
