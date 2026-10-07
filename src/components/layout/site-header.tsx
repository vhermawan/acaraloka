import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";
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
      className="border-b border-border bg-background"
    >
      <Container className="flex h-14 items-center justify-between">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Hadirly
        </Link>

        {session ? (
          <AccountMenu
            name={session.user.name}
            email={session.user.email}
            isOrganizer={isOrganizer}
            isAdmin={session.user.isAdmin === true}
          />
        ) : (
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/login" />}
          >
            Masuk
          </Button>
        )}
      </Container>
    </header>
  );
}

export { SiteHeader };
