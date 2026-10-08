import type { Metadata } from "next";
import Link from "next/link";

import { AdminNav } from "@/components/admin/admin-nav";
import { DisableEventDialog } from "@/components/admin/disable-event-dialog";
import { EnableEventButton } from "@/components/admin/enable-event-button";
import { EventStatusBadge } from "@/components/events/event-status-badge";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { parsePage, parseQuery } from "@/lib/participants";
import { formatEventDateTime } from "@/lib/timezone";
import { requireAdmin } from "@/server/authz";
import { listAdminEvents } from "@/server/admin-events";

import { disableEventAction, enableEventAction } from "./actions";

export const metadata: Metadata = {
  title: "Acara",
};

export default async function AdminEventsPage({ searchParams }: PageProps<"/admin/events">) {
  await requireAdmin();
  const { q, page: pageParam } = await searchParams;
  const query = parseQuery(q);
  const page = parsePage(pageParam);
  const result = await listAdminEvents(query, page);

  function pageHref(target: number) {
    const search = new URLSearchParams();
    if (query) search.set("q", query);
    if (target > 1) search.set("page", String(target));
    const suffix = search.toString();
    return `/admin/events${suffix ? `?${suffix}` : ""}`;
  }

  return (
    <Container className="flex flex-col gap-8 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="text-balance text-2xl font-semibold tracking-tight">Acara</h1>
        <AdminNav />
      </header>

      <form role="search" className="flex max-w-md gap-2">
        <label htmlFor="event-search" className="sr-only">
          Cari judul, slug, atau panitia
        </label>
        <Input id="event-search" name="q" type="search" placeholder="Cari judul, slug, atau panitia" defaultValue={query} />
        <Button type="submit" variant="outline">
          Cari
        </Button>
      </form>

      {result.rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {query ? `Tidak ada acara yang cocok dengan "${query}".` : "Belum ada acara."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Acara</TableHead>
                <TableHead>Panitia</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Mulai</TableHead>
                <TableHead className="text-right">Pendaftar</TableHead>
                <TableHead className="sr-only">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="max-w-xs">
                    <p className="truncate font-medium">{row.title}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">{row.slug}</p>
                    {row.disabledReason ? (
                      <p className="mt-1 truncate text-xs text-muted-foreground">Alasan: {row.disabledReason}</p>
                    ) : null}
                  </TableCell>
                  <TableCell>{row.organizer.orgName}</TableCell>
                  <TableCell>
                    <EventStatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatEventDateTime(row.startAt, row.timezone)}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.activeRegistrations}</TableCell>
                  <TableCell className="text-right">
                    {row.status === "DISABLED" ? (
                      <EnableEventButton action={enableEventAction.bind(null, row.id)} />
                    ) : (
                      <DisableEventDialog
                        eventId={row.id}
                        title={row.title}
                        action={disableEventAction.bind(null, row.id)}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {result.pageCount > 1 ? (
        <nav aria-label="Halaman acara" className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground tabular-nums">
            Halaman {Math.min(page, result.pageCount)} dari {result.pageCount} · {result.total} acara
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button variant="outline" size="sm" nativeButton={false} render={<Link href={pageHref(page - 1)} />}>
                Sebelumnya
              </Button>
            ) : null}
            {page < result.pageCount ? (
              <Button variant="outline" size="sm" nativeButton={false} render={<Link href={pageHref(page + 1)} />}>
                Berikutnya
              </Button>
            ) : null}
          </div>
        </nav>
      ) : null}
    </Container>
  );
}
