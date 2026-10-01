import type { Metadata } from "next";
import Link from "next/link";

import { CancelParticipantButton } from "@/components/events/cancel-participant-button";
import { Badge } from "@/components/ui/badge";
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
import {
  PARTICIPANT_STATUS_LABELS,
  answerValue,
  parsePage,
  parseQuery,
  participantStatus,
} from "@/lib/participants";
import { requireEventOwner } from "@/server/authz";
import { prisma } from "@/server/db";
import { listParticipants } from "@/server/participants";

export const metadata: Metadata = {
  title: "Peserta | event-in",
};

const STATUS_VARIANTS = { REGISTERED: "outline", ATTENDED: "default", CANCELLED: "destructive" } as const;

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

  function pageHref(target: number) {
    const search = new URLSearchParams();
    if (query) search.set("q", query);
    if (target > 1) search.set("page", String(target));
    const suffix = search.toString();
    return `/organizer/events/${event.id}/participants${suffix ? `?${suffix}` : ""}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <div className="flex gap-2">
          <dt className="text-muted-foreground">Terdaftar</dt>
          <dd className="font-medium tabular-nums">{result.summary.confirmed}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">Hadir</dt>
          <dd className="font-medium tabular-nums">{result.summary.attended}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground">Batal</dt>
          <dd className="font-medium tabular-nums">{result.summary.cancelled}</dd>
        </div>
      </dl>

      <form role="search" className="flex max-w-md gap-2">
        <label htmlFor="participant-search" className="sr-only">
          Cari nama atau email
        </label>
        <Input id="participant-search" name="q" type="search" placeholder="Cari nama atau email" defaultValue={query} />
        <Button type="submit" variant="outline">
          Cari
        </Button>
      </form>

      {result.rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {query ? `Tidak ada peserta yang cocok dengan "${query}".` : "Belum ada pendaftar."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>HP</TableHead>
                <TableHead>Tiket</TableHead>
                {fields.map((field) => (
                  <TableHead key={field.id}>{field.label}</TableHead>
                ))}
                <TableHead>Status</TableHead>
                {canCancel ? <TableHead className="sr-only">Aksi</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rows.map((row) => {
                const status = participantStatus(row);
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{row.email}</TableCell>
                    <TableCell className="tabular-nums">{row.phone}</TableCell>
                    <TableCell>{row.ticketType.name}</TableCell>
                    {fields.map((field) => (
                      <TableCell key={field.id}>{answerValue(row.answers, field.id) || "-"}</TableCell>
                    ))}
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[status]}>{PARTICIPANT_STATUS_LABELS[status]}</Badge>
                    </TableCell>
                    {canCancel ? (
                      <TableCell className="text-right">
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
      )}

      {result.pageCount > 1 ? (
        <nav aria-label="Halaman peserta" className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground tabular-nums">
            Halaman {Math.min(page, result.pageCount)} dari {result.pageCount} · {result.total} peserta
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
    </div>
  );
}
