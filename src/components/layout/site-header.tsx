import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";
import { CREATE_EVENT_HREF } from "@/components/layout/create-event-href";
import { SiteNav } from "@/components/layout/site-nav";
import { AccountMenu } from "@/components/auth/account-menu";
import { getSession } from "@/lib/session";
import { prisma } from "@/server/db";

async function SiteHeader() {
  const session = await getSession();
  const isOrganizer = session
    ? !!(await prisma.organizerProfile.findUnique({
        where: { userId: session.user.id },
        select: { userId: true },
      }))
    : false;

  return (
    <header
      data-slot="site-header"
      className="sticky top-0 z-40 border-b border-border bg-background"
    >
      <Container className="relative flex h-16 max-w-[75rem] items-center gap-4 lg:h-[72px]">
        <Link
          href="/"
          className="rounded-md text-[22px] leading-[29px] font-bold tracking-[-0.5px] text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Hadirly
        </Link>

        <SiteNav signedIn={!!session} />

        {session ? (
          <div className="ml-auto">
            <AccountMenu
              name={session.user.name}
              email={session.user.email}
              isOrganizer={isOrganizer}
              isAdmin={session.user.isAdmin === true}
            />
          </div>
        ) : (
          <div className="ml-auto flex items-center gap-2 sm:gap-5">
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center rounded-md px-2 text-[15px] font-medium text-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Masuk
            </Link>
            <Button
              nativeButton={false}
              render={<Link href={CREATE_EVENT_HREF} />}
              className="hidden h-10 px-[18px] text-[15px] sm:inline-flex"
            >
              Buat acara gratis
            </Button>
          </div>
        )}
      </Container>
    </header>
  );
}

export { SiteHeader };
