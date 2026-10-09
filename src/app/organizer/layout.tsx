import { OrganizerShell } from "@/components/organizer/organizer-shell";
import { getSession } from "@/lib/session";
import { prisma } from "@/server/db";

export default async function OrganizerLayout({ children }: LayoutProps<"/organizer">) {
  const session = await getSession();
  const organizer =
    session && session.user.role === "ORGANIZER"
      ? await prisma.organizerProfile.findUnique({
          where: { userId: session.user.id },
          select: { orgName: true },
        })
      : null;

  if (!session || !organizer) return children;

  const events = await prisma.event.findMany({
    where: { organizerId: session.user.id },
    select: { id: true, title: true },
  });

  return (
    <OrganizerShell
      events={events}
      orgName={organizer.orgName}
      userName={session.user.name}
      userEmail={session.user.email}
      isAdmin={session.user.isAdmin === true}
    >
      {children}
    </OrganizerShell>
  );
}
