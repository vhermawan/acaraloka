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
          <span>Kebijakan Privasi (segera hadir)</span>
          <span>Syarat Layanan (segera hadir)</span>
        </div>
      </Container>
    </footer>
  );
}

export { SiteFooter };
