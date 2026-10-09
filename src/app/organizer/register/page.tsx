import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthFrame } from "@/components/auth/auth-frame";
import { AuthScreen } from "@/components/auth/auth-screen";
import { OrganizerRegisterForm } from "@/components/organizer/organizer-register-form";
import { parseAuthNotice } from "@/lib/auth-notice";
import { pageConflict, parseRole, resolvePostLoginPath } from "@/lib/roles";
import { getSession } from "@/lib/session";
import { requireUser } from "@/server/authz";
import { prisma } from "@/server/db";

export const metadata: Metadata = {
  title: "Daftar sebagai panitia",
};

export default async function OrganizerRegisterPage({ searchParams }: PageProps<"/organizer/register">) {
  const { next, error } = await searchParams;
  const nextPath = resolvePostLoginPath("ORGANIZER", next, true);

  const session = await getSession();
  const sessionRole = session ? parseRole(session.user.role) : null;

  if (session && !session.user.disabledAt && sessionRole === "ORGANIZER") {
    const user = await requireUser({ loginPath: "/organizer/login", next: "/organizer/register" });
    const profile = await prisma.organizerProfile.findUnique({
      where: { userId: user.id },
      select: { userId: true },
    });
    if (profile) redirect(nextPath);

    return (
      <AuthFrame
        heading="Data penyelenggara"
        description="Kontak ini bisa dilihat peserta yang mendaftar ke acaramu."
        footer={
          <p>
            Masuk sebagai <span className="font-medium text-foreground">{user.email}</span>
          </p>
        }
      >
        <OrganizerRegisterForm defaultEmail={user.email} next={nextPath} />
      </AuthFrame>
    );
  }

  return (
    <AuthScreen
      role="ORGANIZER"
      mode="register"
      path="/organizer/register"
      next={nextPath}
      conflict={pageConflict(sessionRole, "ORGANIZER", error)}
      disabled={error === "disabled"}
      notice={parseAuthNotice(error)}
    />
  );
}
