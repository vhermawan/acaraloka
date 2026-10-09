import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatEventDateTime } from "@/lib/timezone";
import { requireParticipant } from "@/server/authz";
import { listUserCertificates } from "@/server/certificates";

export const metadata: Metadata = {
  title: "Sertifikat saya",
  robots: { index: false },
};

export default async function MyCertificatesPage() {
  const user = await requireParticipant({ next: "/me/certificates" });
  const certificates = await listUserCertificates(user.id);

  return (
    <Container className="flex max-w-2xl flex-col gap-8 py-12">
      <h1 className="text-balance text-2xl font-semibold tracking-tight">Sertifikat saya</h1>
      {certificates.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center">
          <h2 className="font-medium">Belum ada sertifikat</h2>
          <p className="text-sm text-muted-foreground">
            Sertifikat muncul di sini setelah panitia menerbitkannya untuk acara yang kamu hadiri.
          </p>
          <Button variant="outline" nativeButton={false} render={<Link href="/me/tickets" />}>
            Lihat tiket saya
          </Button>
        </section>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {certificates.map((certificate) => (
            <li key={certificate.id} className="flex items-start justify-between gap-4 p-4">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="font-medium">{certificate.event.title}</span>
                <span className="text-sm text-muted-foreground">
                  {formatEventDateTime(certificate.event.startAt, certificate.event.timezone)}
                </span>
                <span className="break-all font-mono text-xs text-muted-foreground">{certificate.number}</span>
              </div>
              {certificate.revokedAt ? (
                <Badge variant="destructive">Dicabut</Badge>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<a href={`/me/certificates/${encodeURIComponent(certificate.number)}/pdf`} download />}
                >
                  Unduh PDF
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
