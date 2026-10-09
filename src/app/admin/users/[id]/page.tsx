import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DisableUserDialog } from "@/components/admin/disable-user-dialog";
import { EnableUserButton } from "@/components/admin/enable-user-button";
import { UserStatusBadge } from "@/components/admin/user-status-badge";
import { EventStatusBadge } from "@/components/events/event-status-badge";
import { ParticipantStatusBadge } from "@/components/events/participant-status-badge";
import { Badge } from "@/components/ui/badge";
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
  USER_DETAIL_LIST_LIMIT,
  describeUserAgent,
  loginMethods,
  userDisableDenial,
} from "@/lib/admin-users";
import { formatDateTime } from "@/lib/format";
import { participantStatus } from "@/lib/participants";
import { formatEventDateTime } from "@/lib/timezone";
import { getAdminUserDetail } from "@/server/admin-users";
import { requireAdmin } from "@/server/authz";

import { disableUserAction, enableUserAction } from "../actions";

export const metadata: Metadata = {
  title: "Detail pengguna",
};

const HISTORY_LABELS: Record<string, string> = {
  "user.disabled": "Dinonaktifkan",
  "user.enabled": "Diaktifkan kembali",
};

function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="text-lg/[26px] font-semibold">
          {title}
        </h2>
        {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

export default async function AdminUserDetailPage({ params }: PageProps<"/admin/users/[id]">) {
  const admin = await requireAdmin();
  const { id } = await params;
  const detail = await getAdminUserDetail(id);
  if (!detail) notFound();

  const { user } = detail;
  const canDisable = !userDisableDenial(user, admin.id);
  const profile = [
    { label: "Email", value: user.email },
    { label: "Telepon", value: user.phone ?? "-" },
    { label: "Peran", value: ROLE_LABELS[user.role] },
    { label: "Email terverifikasi", value: user.emailVerified ? "Ya" : "Belum" },
    { label: "Metode masuk", value: loginMethods(user.providers).join(", ") || "-" },
    { label: "Terdaftar", value: formatDateTime(user.createdAt) },
    ...(user.organizerProfile
      ? [
          { label: "Nama panitia", value: user.organizerProfile.orgName },
          { label: "Telepon panitia", value: user.organizerProfile.contactPhone },
        ]
      : []),
  ];
  const limitNote = (count: number) =>
    count > USER_DETAIL_LIST_LIMIT ? `Menampilkan ${USER_DETAIL_LIST_LIMIT} terbaru dari ${count}.` : undefined;

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <Link href="/admin/users" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            Kembali ke daftar pengguna
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-balance wrap-break-word text-2xl font-semibold tracking-tight">{user.name}</h1>
            <UserStatusBadge disabled={!!user.disabledAt} />
          </div>
          {user.disabledAt ? (
            <p className="text-sm text-muted-foreground">Dinonaktifkan sejak {formatDateTime(user.disabledAt)}.</p>
          ) : null}
        </div>
        <div className="shrink-0">
          {user.disabledAt ? (
            <EnableUserButton action={enableUserAction.bind(null, user.id)} />
          ) : canDisable ? (
            <DisableUserDialog userId={user.id} name={user.name} action={disableUserAction.bind(null, user.id)} />
          ) : (
            <p className="max-w-56 text-sm text-muted-foreground">
              {user.id === admin.id ? "Akunmu sendiri tidak bisa dinonaktifkan." : "Akun admin tidak bisa dinonaktifkan."}
            </p>
          )}
        </div>
      </header>

      <Section id="profil" title="Profil">
        <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
          {profile.map((item) => (
            <div key={item.label} className="flex flex-col gap-1 bg-background p-4">
              <dt className="text-sm text-muted-foreground">{item.label}</dt>
              <dd className="wrap-break-word text-sm font-medium">{item.value}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {detail.history.length > 0 ? (
        <Section id="riwayat" title="Riwayat status">
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {detail.history.map((entry) => (
              <li key={entry.id} className="flex flex-col gap-1 px-4 py-3 text-sm">
                <span className="font-medium">
                  {HISTORY_LABELS[entry.action] ?? entry.action}
                  <span className="ml-2 font-normal text-muted-foreground">{formatDateTime(entry.createdAt)}</span>
                </span>
                {entry.reason ? <span className="wrap-break-word text-muted-foreground">Alasan: {entry.reason}</span> : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section id="pendaftaran" title="Pendaftaran acara" note={limitNote(detail.registrationCount)}>
        {detail.registrations.length === 0 ? (
          <Empty>Belum mendaftar acara apa pun.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Acara</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Mendaftar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.registrations.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="max-w-xs truncate font-medium">{row.event.title}</TableCell>
                    <TableCell>
                      <ParticipantStatusBadge status={participantStatus(row)} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatDateTime(row.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      <Section id="sertifikat" title="Sertifikat">
        {detail.certificates.length === 0 ? (
          <Empty>Belum ada sertifikat.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nomor</TableHead>
                  <TableHead>Acara</TableHead>
                  <TableHead>Terbit</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.certificates.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">{row.number}</TableCell>
                    <TableCell className="max-w-xs truncate">{row.event.title}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDateTime(row.issuedAt)}</TableCell>
                    <TableCell>
                      {row.revokedAt ? (
                        <Badge variant="outline" className="border-transparent bg-destructive/10 text-destructive">
                          Dicabut
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-transparent bg-success/10 text-success">
                          Berlaku
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      {user.role === "ORGANIZER" ? (
        <Section id="acara" title="Acara milik panitia">
          {detail.events.length === 0 ? (
            <Empty>Belum membuat acara.</Empty>
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
                      <TableCell className="max-w-xs truncate font-medium">{row.title}</TableCell>
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
        </Section>
      ) : null}

      <Section id="sesi" title="Sesi aktif">
        {detail.sessions.length === 0 ? (
          <Empty>Tidak ada sesi aktif.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Perangkat</TableHead>
                  <TableHead>Alamat IP</TableHead>
                  <TableHead>Dibuat</TableHead>
                  <TableHead>Kedaluwarsa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.sessions.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{describeUserAgent(row.userAgent)}</TableCell>
                    <TableCell className="font-mono text-xs">{row.ipAddress ?? "-"}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDateTime(row.createdAt)}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDateTime(row.expiresAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>
    </div>
  );
}
