import type { Metadata } from "next";
import Image from "next/image";

import { AiAllowlistForm } from "@/components/admin/ai-allowlist-form";
import { RemoveAiAllowlistDialog } from "@/components/admin/remove-ai-allowlist-dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { getAdminAiSummary, listAiAllowlist, listRecentAiGenerations, type AdminAiStatus } from "@/server/admin-ai";
import { requireAdmin } from "@/server/authz";
import { addAiAllowlistAction, removeAiAllowlistAction } from "./actions";

export const metadata: Metadata = {
  title: "AI",
};

const STATUS_LABELS: Record<AdminAiStatus, string> = {
  ACTIVE: "Aktif",
  DISABLED: "Nonaktif (konfigurasi)",
  PAUSED: "Dijeda otomatis: cap biaya bulan ini tercapai",
};

const STATUS_CLASSES: Record<AdminAiStatus, string> = {
  ACTIVE: "bg-success/10 text-success",
  DISABLED: "bg-foreground/5 text-muted-foreground",
  PAUSED: "bg-destructive/10 text-destructive",
};

const GENERATION_STATUS_LABELS: Record<string, string> = {
  RUNNING: "Berjalan",
  SUCCEEDED: "Berhasil",
  FAILED: "Gagal",
  REJECTED: "Ditolak",
};

const KIND_LABELS: Record<string, string> = {
  CERTIFICATE: "Sertifikat",
  POSTER: "Poster",
};

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 });
const percent = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

export default async function AdminAiPage() {
  await requireAdmin();
  const [summary, recent, allowlist] = await Promise.all([
    getAdminAiSummary(),
    listRecentAiGenerations(),
    listAiAllowlist(),
  ]);
  const { rows: generations, thumbsFailed } = recent;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h1 className="text-balance text-2xl font-semibold tracking-tight">AI</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="outline" className={`border-transparent ${STATUS_CLASSES[summary.status]}`}>
            {STATUS_LABELS[summary.status]}
          </Badge>
          <span className="text-muted-foreground">
            Cap aktif: {usd.format(summary.capUsd)} per bulan ({summary.trial ? "masa trial" : "normal"})
            {summary.trialEndsOn ? `, trial berakhir ${summary.trialEndsOn}` : ""}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Dijeda otomatis bila sisa cap tidak cukup untuk satu generate, jadi status bisa Dijeda sebelum biaya mencapai 100%.
        </p>
      </header>

      <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
        <div className="flex flex-col gap-1 bg-background p-4">
          <dt className="text-sm text-muted-foreground">Biaya bulan ini</dt>
          <dd className="text-2xl font-semibold tabular-nums">{usd.format(summary.spentUsd)}</dd>
          <dd className="text-xs text-muted-foreground">
            {percent.format(summary.spentPercent)}% dari cap {usd.format(summary.capUsd)}
          </dd>
        </div>
        <div className="flex flex-col gap-1 bg-background p-4">
          <dt className="text-sm text-muted-foreground">Generate hari ini</dt>
          <dd className="text-2xl font-semibold tabular-nums">{summary.todayCount.toLocaleString("id-ID")}</dd>
          <dd className="text-xs text-muted-foreground">
            dari batas harian {summary.globalDailyLimit.toLocaleString("id-ID")}
          </dd>
        </div>
      </dl>

      <section className="flex flex-col gap-4" aria-labelledby="ai-allowlist-heading">
        <h2 id="ai-allowlist-heading" className="text-lg font-semibold">
          Akses AI
        </h2>
        <AiAllowlistForm action={addAiAllowlistAction} />
        {allowlist.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Belum ada akun di daftar akses AI.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Ditambahkan</TableHead>
                  <TableHead className="text-right">Generate</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allowlist.map((row) => (
                  <TableRow key={row.userId}>
                    <TableCell className="whitespace-nowrap">{row.name}</TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">{row.email}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDateTime(row.createdAt)}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.generationCount}</TableCell>
                    <TableCell className="text-right">
                      <RemoveAiAllowlistDialog name={row.name} action={removeAiAllowlistAction.bind(null, row.userId)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="ai-generations-heading">
        <h2 id="ai-generations-heading" className="text-lg font-semibold">
          50 generate terbaru
        </h2>
        {thumbsFailed ? <p className="text-sm text-muted-foreground">Thumbnail gagal dimuat.</p> : null}
        {generations.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Belum ada generate AI.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hasil</TableHead>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Acara</TableHead>
                  <TableHead>Akun</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Biaya</TableHead>
                  <TableHead>Dipakai</TableHead>
                  <TableHead>Dilaporkan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {generations.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      {row.thumbUrl ? (
                        <Image src={row.thumbUrl} alt="" width={80} height={56} unoptimized className="h-14 w-20 rounded-md border border-border object-cover" />
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatDateTime(row.createdAt)}</TableCell>
                    <TableCell className="max-w-48 truncate">{row.eventTitle ?? "-"}</TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">{row.userEmail}</TableCell>
                    <TableCell className="whitespace-nowrap">{KIND_LABELS[row.kind] ?? row.kind}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {GENERATION_STATUS_LABELS[row.status] ?? row.status}
                      {row.failureCode ? <span className="ml-1 font-mono text-xs text-muted-foreground">{row.failureCode}</span> : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{usd.format(row.costUsd)}</TableCell>
                    <TableCell>{row.used ? "Ya" : "Tidak"}</TableCell>
                    <TableCell>{row.reported ? "Mengandung tulisan" : "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
