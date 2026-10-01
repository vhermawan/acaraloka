import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { requireOrganizer } from "@/server/authz";

export const metadata: Metadata = {
  title: "Dashboard panitia | event-in",
};

export default async function OrganizerDashboardPage() {
  const { organizer } = await requireOrganizer();

  return (
    <Container className="flex flex-col gap-8 py-12">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">{organizer.orgName}</p>
        <h1 className="text-balance text-2xl font-semibold tracking-tight">Acara kamu</h1>
      </header>
      <section className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
        <h2 className="font-medium">Belum ada acara</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Acara yang kamu buat akan muncul di sini.
        </p>
      </section>
    </Container>
  );
}
