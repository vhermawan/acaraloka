import type { Metadata } from "next";
import Link from "next/link";

import { UserStatusBadge } from "@/components/admin/user-status-badge";
import { Badge } from "@/components/ui/badge";
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
  ROLE_LABELS,
  STATUS_LABELS,
  USER_STATUS_FILTERS,
  loginMethods,
  parseRoleFilter,
  parseStatusFilter,
} from "@/lib/admin-users";
import { formatDateTime } from "@/lib/format";
import { parsePage, parseQuery } from "@/lib/participants";
import { USER_ROLES } from "@/lib/roles";
import { listAdminUsers } from "@/server/admin-users";
import { requireAdmin } from "@/server/authz";

export const metadata: Metadata = {
  title: "Pengguna",
};

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  await requireAdmin();
  const { q, role: roleParam, status: statusParam, page: pageParam } = await searchParams;
  const filters = { query: parseQuery(q), role: parseRoleFilter(roleParam), status: parseStatusFilter(statusParam) };
  const page = parsePage(pageParam);
  const result = await listAdminUsers(filters, page);
  const filtered = !!(filters.query || filters.role || filters.status);

  function pageHref(target: number) {
    const search = new URLSearchParams();
    if (filters.query) search.set("q", filters.query);
    if (filters.role) search.set("role", filters.role);
    if (filters.status) search.set("status", filters.status);
    if (target > 1) search.set("page", String(target));
    const suffix = search.toString();
    return `/admin/users${suffix ? `?${suffix}` : ""}`;
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-balance text-2xl font-semibold tracking-tight">Pengguna</h1>
      </header>

      <form role="search" className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1.5 sm:max-w-sm">
          <label htmlFor="user-search" className="text-sm font-medium">
            Cari nama atau email
          </label>
          <Input id="user-search" name="q" type="search" placeholder="Nama atau email" defaultValue={filters.query} />
        </div>
        <div className="flex flex-col gap-1.5 sm:w-40">
          <label htmlFor="user-role" className="text-sm font-medium">
            Peran
          </label>
          <NativeSelect id="user-role" name="role" defaultValue={filters.role ?? ""}>
            <option value="">Semua peran</option>
            {USER_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5 sm:w-44">
          <label htmlFor="user-status" className="text-sm font-medium">
            Status
          </label>
          <NativeSelect id="user-status" name="status" defaultValue={filters.status ?? ""}>
            <option value="">Semua status</option>
            {USER_STATUS_FILTERS.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex gap-2">
          <Button type="submit" variant="outline">
            Terapkan
          </Button>
          {filtered ? (
            <Button variant="ghost" nativeButton={false} render={<Link href="/admin/users" />}>
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
          ) : filtered ? (
            "Tidak ada pengguna yang cocok dengan pencarian atau filter ini."
          ) : (
            "Belum ada pengguna."
          )}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pengguna</TableHead>
                <TableHead>Peran</TableHead>
                <TableHead>Email terverifikasi</TableHead>
                <TableHead>Metode masuk</TableHead>
                <TableHead>Terdaftar</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="max-w-xs">
                    <Link
                      href={`/admin/users/${row.id}`}
                      className="block truncate font-medium underline-offset-4 hover:underline"
                    >
                      {row.name}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">{row.email}</p>
                  </TableCell>
                  <TableCell>{ROLE_LABELS[row.role]}</TableCell>
                  <TableCell>
                    {row.emailVerified ? (
                      "Ya"
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Belum
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{loginMethods(row.providers).join(", ") || "-"}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDateTime(row.createdAt)}</TableCell>
                  <TableCell>
                    <UserStatusBadge disabled={!!row.disabledAt} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {result.pageCount > 1 ? (
        <nav aria-label="Halaman pengguna" className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground tabular-nums">
            Halaman {Math.min(page, result.pageCount)} dari {result.pageCount} · {result.total} pengguna
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
