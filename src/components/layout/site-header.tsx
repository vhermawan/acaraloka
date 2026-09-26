import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/layout/container";

function SiteHeader() {
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

        <Button variant="outline" size="sm" disabled>
          Masuk (segera hadir)
        </Button>
      </Container>
    </header>
  );
}

export { SiteHeader };
