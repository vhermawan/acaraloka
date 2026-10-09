import type { Metadata } from "next";

import { formatBytes } from "@/lib/format";
import { getAdminStats } from "@/server/admin-stats";
import { requireAdmin } from "@/server/authz";

export const metadata: Metadata = {
  title: "Ringkasan",
};

const DB_LIMIT_BYTES = 500 * 1024 * 1024;

export default async function AdminPage() {
  await requireAdmin();
  const stats = await getAdminStats();

  const items = [
    { label: "Acara terbit", value: stats.publishedEvents.toLocaleString("id-ID") },
    { label: "Pendaftaran 24 jam", value: stats.registrations24h.toLocaleString("id-ID") },
    { label: "Error 24 jam", value: stats.errors24h.toLocaleString("id-ID") },
    {
      label: "Ukuran database",
      value: formatBytes(stats.dbSizeBytes),
      hint: `dari ${formatBytes(DB_LIMIT_BYTES)} kuota gratis`,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-balance text-2xl font-semibold tracking-tight">Ringkasan</h1>
      </header>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col gap-1 bg-background p-4">
            <dt className="text-sm text-muted-foreground">{item.label}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{item.value}</dd>
            {item.hint ? <dd className="text-xs text-muted-foreground">{item.hint}</dd> : null}
          </div>
        ))}
      </dl>
    </div>
  );
}
