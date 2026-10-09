import type { Metadata } from "next";
import Link from "next/link";
import { Search, Users } from "lucide-react";

import { CancelParticipantButton } from "@/components/events/cancel-participant-button";
import { ParticipantStatusBadge } from "@/components/events/participant-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { answerValue, parsePage, parseQuery, participantStatus } from "@/lib/participants";
import { requireEventOwner } from "@/server/authz";
import { prisma } from "@/server/db";
import { listParticipants } from "@/server/participants";

export const metadata: Metadata = {
  title: "Peserta",
};

const stickyCell =
  "sticky left-0 z-10 bg-card shadow-[inset_-1px_0_0_var(--color-border)] group-hover/row:bg-[color-mix(in_oklch,var(--card),var(--muted)_50%)]";

export default async function ParticipantsPage({
  params,
  searchParams,
}: PageProps<"/organizer/events/[id]/participants">) {
  const { id } = await params;
  const { q, page: pageParam } = await searchParams;
  const { event } = await requireEventOwner(id);
  const query = parseQuery(q);
  const page = parsePage(pageParam);
  const canCancel = event.status === "PUBLISHED";

  const [fields, result] = await Promise.all([
    prisma.formField.findMany({ where: { eventId: event.id }, orderBy: { order: "asc" } }),
    listParticipants(event.id, query, page),
  ]);

  const basePath = `/organizer/events/${event.id}/participants`;

  function pageHref(target: number) {
    const search = new URLSearchParams();
    if (query) search.set("q", query);
    if (target > 1) search.set("page", String(target));
    const suffix = search.toString();
    return `${basePath}${suffix ? `?${suffix}` : ""}`;
  }

  const stats = [
    { label: "Terdaftar", value: result.summary.confirmed },
    { label: "Hadir", value: result.summary.attended },
    { label: "Batal", value: result.summary.cancelled },
  ];

  return (
    <div className="flex flex-col gap-6">
      <dl className="flex flex-wrap divide-x divide-border">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-0.5 px-5 first:pl-0">
            <dt className="text-sm text-muted-foreground">{stat.label}</dt>
            <dd className="text-2xl/8 font-bold tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <form role="search" action={basePath} className="flex max-w-md gap-2">
        <label htmlFor="participant-search" className="sr-only">
          Cari nama atau email
        </label>
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="participant-search"
            name="q"
            type="search"
            placeholder="Cari nama atau email"
            defaultValue={query}
            className="h-10 pl-9"
          />
        </div>
        <Button type="submit" variant="outline" className="h-10 px-4">
          Cari
        </Button>
      </form>

      {result.rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-12 text-center">
          <Users className="size-7 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            {query ? `Tidak ada peserta yang cocok dengan "${query}".` : "Belum ada pendaftar."}
          </p>
          {query ? (
            <Button variant="outline" className="h-10 px-4" nativeButton={false} render={<Link href={basePath} />}>
              Tampilkan semua peserta
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-2 md:hidden">
            {result.rows.map((row) => {
              const status = participantStatus(row);
              return (
                <li key={row.id} className="flex flex-col gap-3 rounded-xl border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <p className="font-semibold wrap-break-word">{row.name}</p>
                      <p className="text-sm break-all text-muted-foreground">{row.email}</p>
                      <p className="text-sm text-muted-foreground">{row.ticketType.name}</p>
                    </div>
                    <ParticipantStatusBadge status={status} />
                  </div>
                  {canCancel && status === "REGISTERED" ? (
                    <div className="-mb-1 flex justify-end">
                      <CancelParticipantButton eventId={event.id} registrationId={row.id} name={row.name} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={`${stickyCell} px-4`}>Nama</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>HP</TableHead>
                  <TableHead>Tiket</TableHead>
                  {fields.map((field) => (
                    <TableHead key={field.id} className="max-w-48 truncate">
                      {field.label}
                    </TableHead>
                  ))}
                  <TableHead>Status</TableHead>
                  {canCancel ? (
                    <TableHead>
                      <span className="sr-only">Aksi</span>
                    </TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((row) => {
                  const status = participantStatus(row);
                  return (
                    <TableRow key={row.id} className="group/row">
                      <TableCell className={`${stickyCell} max-w-56 truncate px-4 font-medium`}>{row.name}</TableCell>
                      <TableCell>{row.email}</TableCell>
                      <TableCell className="tabular-nums">{row.phone}</TableCell>
                      <TableCell>{row.ticketType.name}</TableCell>
                      {fields.map((field) => (
                        <TableCell key={field.id} className="max-w-56 truncate">
                          {answerValue(row.answers, field.id) || <span className="text-muted-foreground">-</span>}
                        </TableCell>
                      ))}
                      <TableCell>
                        <ParticipantStatusBadge status={status} />
                      </TableCell>
                      {canCancel ? (
                        <TableCell className="pr-4 text-right">
                          {status === "REGISTERED" ? (
                            <CancelParticipantButton eventId={event.id} registrationId={row.id} name={row.name} />
                          ) : null}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {result.pageCount > 1 ? (
        <nav
          aria-label="Halaman peserta"
          className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="text-muted-foreground tabular-nums">
            Halaman {Math.min(page, result.pageCount)} dari {result.pageCount} · {result.total} peserta
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button variant="outline" className="h-10 px-4" nativeButton={false} render={<Link href={pageHref(page - 1)} />}>
                Sebelumnya
              </Button>
            ) : null}
            {page < result.pageCount ? (
              <Button variant="outline" className="h-10 px-4" nativeButton={false} render={<Link href={pageHref(page + 1)} />}>
                Berikutnya
              </Button>
            ) : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
