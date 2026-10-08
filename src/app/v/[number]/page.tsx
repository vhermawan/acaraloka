import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { APP_NAME } from "@/lib/brand";
import { formatCertificateDate } from "@/server/certificate-config";
import { verifyCertificate } from "@/server/certificate-verification";

export const metadata: Metadata = {
  title: "Verifikasi sertifikat",
  description: `Periksa keaslian sertifikat yang diterbitkan lewat ${APP_NAME}.`,
  robots: { index: false, follow: false },
  openGraph: { title: `Verifikasi sertifikat | ${APP_NAME}`, description: `Periksa keaslian sertifikat yang diterbitkan lewat ${APP_NAME}.` },
};

const ISSUE_TIMEZONE = "Asia/Jakarta";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-4">
      <dt className="text-sm text-muted-foreground sm:w-40 sm:shrink-0">{label}</dt>
      <dd className="min-w-0 break-words font-medium">{children}</dd>
    </div>
  );
}

export default async function VerifyCertificatePage({ params }: PageProps<"/v/[number]">) {
  const { number } = await params;
  const certificate = await verifyCertificate(number);
  if (!certificate) notFound();

  const revoked = certificate.status === "REVOKED";

  return (
    <Container className="flex max-w-2xl flex-col gap-8 py-12">
      <header className="flex flex-col items-start gap-3">
        <Badge variant={revoked ? "destructive" : "default"}>
          {revoked ? "Dicabut oleh penyelenggara" : `Terverifikasi di ${APP_NAME}`}
        </Badge>
        <h1 className="text-balance text-2xl font-semibold tracking-tight">Verifikasi sertifikat</h1>
        {revoked ? (
          <p className="text-sm text-muted-foreground">
            Penyelenggara mencabut sertifikat ini pada {formatCertificateDate(certificate.revokedAt!, ISSUE_TIMEZONE)}.
            Sertifikat tidak berlaku.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nomor ini tercatat sebagai sertifikat yang diterbitkan lewat {APP_NAME}.
          </p>
        )}
      </header>
      <dl className="divide-y divide-border rounded-lg border border-border px-4">
        <Row label="Penerima">{certificate.recipientName}</Row>
        <Row label="Nomor">
          <span className="break-all font-mono text-sm">{certificate.number}</span>
        </Row>
        <Row label="Acara">{certificate.eventTitle}</Row>
        <Row label="Tanggal acara">{certificate.eventDate}</Row>
        <Row label="Penyelenggara">{certificate.organizerName}</Row>
        <Row label="Penandatangan">
          <ul className="flex flex-col gap-1">
            {certificate.signers.map((signer) => (
              <li key={`${signer.name}-${signer.title}`}>
                {signer.name} <span className="font-normal text-muted-foreground">({signer.title})</span>
              </li>
            ))}
          </ul>
        </Row>
        <Row label="Tanggal terbit">{formatCertificateDate(certificate.issuedAt, ISSUE_TIMEZONE)}</Row>
        {revoked ? <Row label="Tanggal dicabut">{formatCertificateDate(certificate.revokedAt!, ISSUE_TIMEZONE)}</Row> : null}
      </dl>
      <p className="text-sm text-muted-foreground">
        Tanda tangan pada sertifikat adalah gambar yang dibubuhkan lewat tautan penandatangan di {APP_NAME}, bukan tanda
        tangan elektronik tersertifikasi.
      </p>
    </Container>
  );
}
