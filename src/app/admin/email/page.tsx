import type { Metadata } from "next";
import Link from "next/link";

import { DrainQueueButton } from "@/components/admin/drain-queue-button";
import { EmailStatusBadge } from "@/components/admin/email-status-badge";
import { Button } from "@/components/ui/button";
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
  EMAIL_STATUS_FILTERS,
  EMAIL_STATUS_LABELS,
  EMAIL_TEMPLATES,
  EMAIL_TEMPLATE_LABELS,
  parseEmailStatusFilter,
  parseEmailTemplateFilter,
} from "@/lib/admin-email";
import { formatDateTime } from "@/lib/format";
import { parsePage } from "@/lib/participants";
import { getEmailOverview, listEmailOutbox } from "@/server/admin-email";
import { requireAdmin } from "@/server/authz";
import { drainQueueAction } from "./actions";

export const metadata: Metadata = {
  title: "Email",
};

export const maxDuration = 60;

export default async function AdminEmailPage({ searchParams }: PageProps<"/admin/email">) {
  await requireAdmin();
  const { status: statusParam, template: templateParam, page: pageParam } = await searchParams;
  const filters = { status: parseEmailStatusFilter(statusParam), template: parseEmailTemplateFilter(templateParam) };
  const page = parsePage(pageParam);
  const [overview, result] = await Promise.all([getEmailOverview(), listEmailOutbox(filters, page)]);
  const filtered = !!(filters.status || filters.template);

  const cards = [
    { label: "Terkirim 24 jam", value: overview.sent24h.toLocaleString("id-ID") },
    { label: "Gagal 24 jam", value: overview.failed24h.toLocaleString("id-ID") },
    {
      label: "Antre",
      value: overview.queued.toLocaleString("id-ID"),
      hint: overview.scheduled > 0 ? `${overview.scheduled.toLocaleString("id-ID")} dijadwalkan ulang` : undefined,
    },
    {
      label: "Sisa anggaran 24 jam",
      value: overview.remainingBudget.toLocaleString("id-ID"),
      hint: `dari ${overview.budget.toLocaleString("id-ID")} email`,
    },
    { label: "Pengiriman email", value: overview.enabled ? "Aktif" : "Mati", hint: "EMAIL_ENABLED" },
  ];

  const drainHint = !overview.enabled
    ? "Pengiriman email mati (EMAIL_ENABLED), antrean tidak diproses."
    : overview.remainingBudget === 0
      ? "Anggaran 24 jam habis. Antrean dilanjutkan saat anggaran kembali."
      : "Memproses sampai 20 email per klik, memakai anggaran yang sama dengan cron harian.";

  function pageHref(target: number) {
    const search = new URLSearchParams();
    if (filters.status) search.set("status", filters.status);
    if (filters.template) search.set("template", filters.template);
    if (target > 1) search.set("page", String(target));
    const suffix = search.toString();
    return `/admin/email${suffix ? `?${suffix}` : ""}`;
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-balance text-2xl font-semibold tracking-tight">Email</h1>
      </header>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="flex flex-col gap-1 bg-background p-4">
            <dt className="text-sm text-muted-foreground">{card.label}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{card.value}</dd>
            {card.hint ? <dd className="text-xs text-muted-foreground">{card.hint}</dd> : null}
          </div>
        ))}
      </dl>

      {overview.queued > 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <DrainQueueButton
            action={drainQueueAction}
            disabled={!overview.enabled || overview.remainingBudget === 0}
          />
          <p className="text-sm text-muted-foreground">{drainHint}</p>
        </div>
      ) : null}

      <form role="search" className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-1.5 sm:w-44">
          <label htmlFor="email-status" className="text-sm font-medium">
            Status
          </label>
          <NativeSelect id="email-status" name="status" defaultValue={filters.status ?? ""}>
            <option value="">Semua status</option>
            {EMAIL_STATUS_FILTERS.map((status) => (
              <option key={status} value={status}>
                {EMAIL_STATUS_LABELS[status]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5 sm:w-56">
          <label htmlFor="email-template" className="text-sm font-medium">
            Templat
          </label>
          <NativeSelect id="email-template" name="template" defaultValue={filters.template ?? ""}>
            <option value="">Semua templat</option>
            {EMAIL_TEMPLATES.map((template) => (
              <option key={template} value={template}>
                {EMAIL_TEMPLATE_LABELS[template]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex gap-2">
          <Button type="submit" variant="outline">
            Terapkan
          </Button>
          {filtered ? (
            <Button variant="ghost" nativeButton={false} render={<Link href="/admin/email" />}>
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
            "Tidak ada email yang cocok dengan filter ini."
          ) : (
            "Belum ada email di outbox."
          )}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Templat</TableHead>
                <TableHead>Penerima</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Percobaan</TableHead>
                <TableHead>Error</TableHead>
                <TableHead>Dibuat</TableHead>
                <TableHead>Terkirim</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap">
                    {EMAIL_TEMPLATE_LABELS[row.template as keyof typeof EMAIL_TEMPLATE_LABELS] ?? row.template}
                  </TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs">{row.recipient}</TableCell>
                  <TableCell>
                    <EmailStatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.attempts}</TableCell>
                  <TableCell className="max-w-xs wrap-break-word whitespace-normal text-xs text-muted-foreground">
                    {row.error ?? "-"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatDateTime(row.createdAt)}</TableCell>
                  <TableCell className="whitespace-nowrap">{row.sentAt ? formatDateTime(row.sentAt) : "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {result.pageCount > 1 ? (
        <nav aria-label="Halaman email" className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground tabular-nums">
            Halaman {Math.min(page, result.pageCount)} dari {result.pageCount} · {result.total} email
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
