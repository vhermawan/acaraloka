import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DisableUserDialog } from "@/components/admin/disable-user-dialog";
import { EnableUserButton } from "@/components/admin/enable-user-button";
import { UserStatusBadge } from "@/components/admin/user-status-badge";
import { EventStatusBadge } from "@/components/events/event-status-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ORGANIZER_EVENT_LIST_LIMIT, eventCountSummary } from "@/lib/admin-organizers";
import { userDisableDenial } from "@/lib/admin-users";
import { formatDateTime } from "@/lib/format";
import { formatEventDateTime } from "@/lib/timezone";
import { getAdminOrganizerDetail } from "@/server/admin-organizers";
import { requireAdmin } from "@/server/authz";

import { disableUserAction, enableUserAction } from "../../users/actions";

export const metadata: Metadata = {
  title: "Detail panitia",
};

export default async function AdminOrganizerDetailPage({ params }: PageProps<"/admin/organizers/[id]">) {
  const admin = await requireAdmin();
  const { id } = await params;
  const detail = await getAdminOrganizerDetail(id);
  if (!detail) notFound();

  const { organizer } = detail;
  const canDisable = !userDisableDenial({ id: organizer.id, role: "ORGANIZER" }, admin.id);
  const summary = eventCountSummary(organizer.eventCounts);
  const profile = [
    { label: "Akun", value: `${organizer.accountName} (${organizer.accountEmail})` },
    { label: "Telepon", value: organizer.contactPhone },
    { label: "Email kontak", value: organizer.contactEmail ?? "-" },
    { label: "Bergabung sebagai panitia", value: formatDateTime(organizer.activatedAt) },
    { label: "Terakhir aktif", value: organizer.lastActiveAt ? formatDateTime(organizer.lastActiveAt) : "-" },
    { label: "Acara", value: summary.length > 0 ? `${organizer.eventTotal} (${summary.join(", ")})` : "0" },
    { label: "Total pendaftar", value: String(organizer.registrantCount) },
    { label: "Sertifikat terbit", value: String(organizer.certificateCount) },
  ];

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <Link href="/admin/organizers" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            Kembali ke daftar panitia
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-balance wrap-break-word text-2xl font-semibold tracking-tight">{organizer.orgName}</h1>
            <UserStatusBadge disabled={!!organizer.disabledAt} />
          </div>
          {organizer.disabledAt ? (
            <p className="text-sm text-muted-foreground">
              Akun dinonaktifkan sejak {formatDateTime(organizer.disabledAt)}.
            </p>
          ) : null}
          <Link
            href={`/admin/users/${organizer.id}`}
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Lihat detail akun
          </Link>
        </div>
        <div className="shrink-0">
          {organizer.disabledAt ? (
            <EnableUserButton action={enableUserAction.bind(null, organizer.id)} />
          ) : canDisable ? (
            <DisableUserDialog
              userId={organizer.id}
              name={organizer.orgName}
              action={disableUserAction.bind(null, organizer.id)}
            />
          ) : (
            <p className="max-w-56 text-sm text-muted-foreground">Akunmu sendiri tidak bisa dinonaktifkan.</p>
          )}
        </div>
      </header>

      <section aria-labelledby="profil" className="flex flex-col gap-3">
        <h2 id="profil" className="text-lg/[26px] font-semibold">
          Profil organisasi
        </h2>
        <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
          {profile.map((item) => (
            <div key={item.label} className="flex flex-col gap-1 bg-background p-4">
              <dt className="text-sm text-muted-foreground">{item.label}</dt>
              <dd className="wrap-break-word text-sm font-medium">{item.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="acara" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="flex flex-col gap-1">
            <h2 id="acara" className="text-lg/[26px] font-semibold">
              Acara
            </h2>
            {detail.eventTotal > ORGANIZER_EVENT_LIST_LIMIT ? (
              <p className="text-sm text-muted-foreground">
                Menampilkan {ORGANIZER_EVENT_LIST_LIMIT} terbaru dari {detail.eventTotal}.
              </p>
            ) : null}
          </div>
          {detail.eventTotal > 0 ? (
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={`/admin/events?organizer=${encodeURIComponent(organizer.id)}`} />}
            >
              Kelola di daftar acara
            </Button>
          ) : null}
        </div>
        {detail.events.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Belum membuat acara.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Acara</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Mulai</TableHead>
                  <TableHead className="text-right">Pendaftar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.events.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="max-w-xs">
                      <p className="truncate font-medium">{row.title}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">{row.slug}</p>
                    </TableCell>
                    <TableCell>
                      <EventStatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatEventDateTime(row.startAt, row.timezone)}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.activeRegistrations}</TableCell>
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
