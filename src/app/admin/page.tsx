import type { Metadata } from "next";

import { BarChart } from "@/components/admin/bar-chart";
import { formatDayLabel, formatWeekLabel, usagePercent } from "@/lib/admin-stats";
import { formatBytes } from "@/lib/format";
import { getAdminStats } from "@/server/admin-stats";
import { requireAdmin } from "@/server/authz";

export const metadata: Metadata = {
  title: "Ringkasan",
};

const number = (value: number) => value.toLocaleString("id-ID");

export default async function AdminPage() {
  await requireAdmin();
  const stats = await getAdminStats();

  const items = [
    {
      label: "Pengguna",
      value: number(stats.users.participants + stats.users.organizers),
      hint: `${number(stats.users.participants)} peserta, ${number(stats.users.organizers)} panitia, termasuk nonaktif`,
    },
    {
      label: "Acara terbit",
      value: number(stats.events.published),
      hint: `${number(stats.events.draft)} draf, ${number(stats.events.cancelled)} dibatalkan, ${number(stats.events.disabled)} dinonaktifkan`,
    },
    {
      label: "Pendaftaran 24 jam",
      value: number(stats.registrations24h),
      hint: `${number(stats.registrations7d)} dalam 7 hari`,
    },
    {
      label: "Check-in",
      value: number(stats.checkedInTotal),
      hint: `${number(stats.checkedIn24h)} dalam 24 jam`,
    },
    { label: "Sertifikat terbit", value: number(stats.certificatesIssued) },
    { label: "Error 24 jam", value: number(stats.errors24h) },
    {
      label: "Ukuran database",
      value: formatBytes(stats.dbSizeBytes),
      hint: `${usagePercent(stats.dbSizeBytes, stats.dbQuotaBytes)}% dari ${formatBytes(stats.dbQuotaBytes)} kuota gratis`,
    },
    {
      label: "Email terpakai 24 jam",
      value: number(stats.emailsSent24h),
      hint: `terkirim dan sedang dikirim, dari anggaran ${number(stats.emailBudget)}`,
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
            {item.hint ? <dd className="text-pretty text-xs text-muted-foreground">{item.hint}</dd> : null}
          </div>
        ))}
      </dl>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <BarChart
            title="Pendaftaran per hari"
            description="30 hari terakhir, waktu WIB."
            unit="pendaftaran"
            series={stats.registrationsDaily}
            formatLabel={formatDayLabel}
            tickEvery={5}
          />
        </div>
        <BarChart
          title="Pengguna baru per minggu"
          description="12 minggu terakhir, minggu mulai Senin, waktu WIB."
          unit="pengguna"
          series={stats.usersWeekly}
          formatLabel={formatWeekLabel}
          tickEvery={4}
        />
        <BarChart
          title="Acara terbit per minggu"
          description="12 minggu terakhir, minggu mulai Senin, waktu WIB."
          unit="acara"
          series={stats.publishedEventsWeekly}
          formatLabel={formatWeekLabel}
          tickEvery={4}
        />
      </div>
    </div>
  );
}
