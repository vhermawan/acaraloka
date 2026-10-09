import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthScreen } from "@/components/auth/auth-screen";
import { parseAuthNotice } from "@/lib/auth-notice";
import { adminLoginConflict, parseRole, resolvePostLoginPath } from "@/lib/roles";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Masuk admin",
  robots: { index: false },
};

export default async function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  const { next, error, notice: rawNotice } = await searchParams;
  const nextPath = resolvePostLoginPath("ADMIN", next, true);

  const session = await getSession();
  const sessionRole = session ? parseRole(session.user.role) : null;
  if (session && !session.user.disabledAt && sessionRole === "ADMIN") redirect(nextPath);

  const notice = parseAuthNotice(error, rawNotice);

  return (
    <AuthScreen
      role="ADMIN"
      mode="login"
      path="/admin/login"
      next={nextPath}
      conflict={adminLoginConflict(sessionRole, error, parseAuthNotice(error) !== null)}
      disabled={error === "disabled"}
      notice={notice}
    />
  );
}
