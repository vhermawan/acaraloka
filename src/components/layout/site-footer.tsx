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
        <div className="flex gap-4">
          <Link href="/legal/privacy" className="hover:text-foreground">
            Kebijakan Privasi
          </Link>
          <Link href="/legal/terms" className="hover:text-foreground">
            Syarat Layanan
          </Link>
        </div>
      </Container>
    </footer>
  );
}

export { SiteFooter };
