import Link from "next/link";

import { Container } from "@/components/layout/container";

function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer
      data-slot="site-footer"
      className="border-t border-border bg-background"
    >
      <Container className="flex flex-col gap-3 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>&copy; {year} event-in.</p>
        <nav aria-label="Tautan legal" className="flex gap-4">
          <Link
            href="/legal/privacy"
            prefetch={false}
            className="hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Kebijakan Privasi
          </Link>
          <Link
            href="/legal/terms"
            prefetch={false}
            className="hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Syarat Layanan
          </Link>
        </nav>
      </Container>
    </footer>
  );
}

export { SiteFooter };
