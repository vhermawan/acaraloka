import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";
import { AccountMenu } from "@/components/auth/account-menu";
import { getSession } from "@/lib/session";

async function SiteHeader() {
  const session = await getSession();

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
          event-in
        </Link>

        {session ? (
          <AccountMenu name={session.user.name} email={session.user.email} />
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
