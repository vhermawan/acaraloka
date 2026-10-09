import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthScreen } from "@/components/auth/auth-screen";
import { parseAuthNotice } from "@/lib/auth-notice";
import { parseRole, parseRoleConflict, resolvePostLoginPath } from "@/lib/roles";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Daftar",
};

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const { next, error } = await searchParams;
  const nextPath = resolvePostLoginPath("PARTICIPANT", next, true);

  const session = await getSession();
  const sessionRole = session ? parseRole(session.user.role) : null;
  if (session && !session.user.disabledAt && sessionRole === "PARTICIPANT") redirect(nextPath);

  return (
    <AuthScreen
      role="PARTICIPANT"
      mode="register"
      path="/register"
      next={nextPath}
      conflict={sessionRole === "ORGANIZER" ? "role-organizer" : parseRoleConflict(error)}
      disabled={error === "disabled"}
      notice={parseAuthNotice(error)}
    />
  );
}
