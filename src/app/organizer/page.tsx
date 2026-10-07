import type { Metadata } from "next";
import Link from "next/link";

import { EventStatusBadge } from "@/components/events/event-status-badge";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatEventDate } from "@/lib/timezone";
import { requireOrganizer } from "@/server/authz";
import { prisma } from "@/server/db";

export const metadata: Metadata = {
  title: "Dashboard panitia | Hadirly",
};

export default async function OrganizerDashboardPage() {
  const { user, organizer } = await requireOrganizer();
  const events = await prisma.event.findMany({
    where: { organizerId: user.id },
    orderBy: { startAt: "desc" },
    select: { id: true, title: true, status: true, startAt: true, timezone: true },
  });

  return (
    <Container className="flex flex-col gap-8 py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">{organizer.orgName}</p>
          <h1 className="text-balance text-2xl font-semibold tracking-tight">Acara kamu</h1>
        </div>
        <Button nativeButton={false} render={<Link href="/organizer/events/new" />}>
          Buat acara
        </Button>
      </header>
      {events.length === 0 ? (
        <section className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
          <h2 className="font-medium">Belum ada acara</h2>
          <p className="mt-1 text-sm text-muted-foreground">Acara yang kamu buat akan muncul di sini.</p>
        </section>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Acara</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => (
              <TableRow key={event.id}>
                <TableCell className="font-medium">
                  <Link href={`/organizer/events/${event.id}`} className="hover:underline">
                    {event.title}
                  </Link>
                </TableCell>
                <TableCell className="whitespace-nowrap">{formatEventDate(event.startAt, event.timezone)}</TableCell>
                <TableCell>
                  <EventStatusBadge status={event.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Container>
  );
}
