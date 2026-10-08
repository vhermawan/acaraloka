import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";
import { CREATE_EVENT_HREF } from "@/components/layout/create-event-href";
import { SiteNav } from "@/components/layout/site-nav";
import { AccountMenu } from "@/components/auth/account-menu";
import { getSession } from "@/lib/session";
import { APP_NAME } from "@/lib/brand";
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
          className="-ml-2 shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Image
            src="/logo/acaraloka-horizontal.svg"
            alt={APP_NAME}
            width={431}
            height={96}
            priority
            className="h-12 w-auto"
          />
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
