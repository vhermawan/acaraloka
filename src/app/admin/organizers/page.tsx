import type { Metadata } from "next";
import Link from "next/link";

import { UserStatusBadge } from "@/components/admin/user-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DEFAULT_ORGANIZER_SORT,
  ORGANIZER_SORTS,
  ORGANIZER_SORT_LABELS,
  eventCountSummary,
  parseOrganizerSort,
} from "@/lib/admin-organizers";
import { formatDateTime } from "@/lib/format";
import { parsePage, parseQuery } from "@/lib/participants";
import { listAdminOrganizers } from "@/server/admin-organizers";
import { requireAdmin } from "@/server/authz";

export const metadata: Metadata = {
  title: "Panitia",
};

export default async function AdminOrganizersPage({ searchParams }: PageProps<"/admin/organizers">) {
  await requireAdmin();
  const { q, sort: sortParam, page: pageParam } = await searchParams;
  const filters = { query: parseQuery(q), sort: parseOrganizerSort(sortParam) };
  const page = parsePage(pageParam);
  const result = await listAdminOrganizers(filters, page);
  const filtered = !!filters.query || filters.sort !== DEFAULT_ORGANIZER_SORT;

  function pageHref(target: number) {
    const search = new URLSearchParams();
    if (filters.query) search.set("q", filters.query);
    if (filters.sort !== DEFAULT_ORGANIZER_SORT) search.set("sort", filters.sort);
    if (target > 1) search.set("page", String(target));
    const suffix = search.toString();
    return `/admin/organizers${suffix ? `?${suffix}` : ""}`;
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-balance text-2xl font-semibold tracking-tight">Panitia</h1>
      </header>

      <form role="search" className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1.5 sm:max-w-sm">
          <label htmlFor="organizer-search" className="text-sm font-medium">
            Cari organisasi, akun, atau kontak
          </label>
          <Input
            id="organizer-search"
            name="q"
            type="search"
            placeholder="Nama organisasi atau email"
            defaultValue={filters.query}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:w-56">
          <label htmlFor="organizer-sort" className="text-sm font-medium">
            Urutkan
          </label>
          <NativeSelect id="organizer-sort" name="sort" defaultValue={filters.sort}>
            {ORGANIZER_SORTS.map((sort) => (
              <option key={sort} value={sort}>
                {ORGANIZER_SORT_LABELS[sort]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex gap-2">
          <Button type="submit" variant="outline">
            Terapkan
          </Button>
          {filtered ? (
            <Button variant="ghost" nativeButton={false} render={<Link href="/admin/organizers" />}>
              Atur ulang
            </Button>
          ) : null}
        </div>
      </form>

      {result.rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {result.total > 0 ? (
            <>
              Halaman ini kosong.{" "}
              <Link href={pageHref(1)} className="underline underline-offset-4 hover:text-foreground">
                Kembali ke halaman 1
              </Link>
            </>
          ) : filters.query ? (
            "Tidak ada panitia yang cocok dengan pencarian ini."
          ) : (
            "Belum ada panitia."
          )}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organisasi</TableHead>
                <TableHead>Akun</TableHead>
                <TableHead>Kontak</TableHead>
                <TableHead>Acara</TableHead>
                <TableHead className="text-right">Pendaftar</TableHead>
                <TableHead className="text-right">Sertifikat</TableHead>
                <TableHead>Terakhir aktif</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rows.map((row) => {
                const summary = eventCountSummary(row.eventCounts);
                return (
                  <TableRow key={row.id}>
                    <TableCell className="max-w-xs">
                      <Link
                        href={`/admin/organizers/${row.id}`}
                        className="block truncate font-medium underline-offset-4 hover:underline"
                      >
                        {row.orgName}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="truncate">{row.accountName}</p>
                      <p className="truncate text-xs text-muted-foreground">{row.accountEmail}</p>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="truncate">{row.contactPhone}</p>
                      {row.contactEmail ? (
                        <p className="truncate text-xs text-muted-foreground">{row.contactEmail}</p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <p className="tabular-nums">{row.eventTotal}</p>
                      {summary.length > 0 ? (
                        <p className="text-xs text-muted-foreground">{summary.join(" · ")}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.registrantCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.certificateCount}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {row.lastActiveAt ? formatDateTime(row.lastActiveAt) : "-"}
                    </TableCell>
                    <TableCell>
                      <UserStatusBadge disabled={!!row.disabledAt} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {result.pageCount > 1 ? (
        <nav aria-label="Halaman panitia" className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground tabular-nums">
            Halaman {Math.min(page, result.pageCount)} dari {result.pageCount} · {result.total} panitia
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
