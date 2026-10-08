import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { normalizeCertificateNumber } from "@/lib/certificate-verify";
import { formatCertificateDate } from "@/server/certificate-config";
import { prisma } from "@/server/db";

export type CertificateVerification = {
  status: "VALID" | "REVOKED";
  recipientName: string;
  number: string;
  eventTitle: string;
  eventDate: string;
  organizerName: string;
  signers: { name: string; title: string }[];
  issuedAt: Date;
  revokedAt: Date | null;
};

export async function verifyCertificate(
  rawNumber: string,
  db: PrismaClient = prisma,
): Promise<CertificateVerification | null> {
  const number = normalizeCertificateNumber(rawNumber);
  if (!number) return null;

  const certificate = await db.certificate.findUnique({
    where: { number },
    select: {
      number: true,
      recipientName: true,
      issuedAt: true,
      revokedAt: true,
      event: {
        select: {
          title: true,
          startAt: true,
          timezone: true,
          organizer: { select: { orgName: true } },
          signers: { where: { status: "SIGNED" }, orderBy: { order: "asc" }, select: { name: true, title: true } },
        },
      },
    },
  });
  if (!certificate) return null;

  const { event } = certificate;
  return {
    status: certificate.revokedAt ? "REVOKED" : "VALID",
    recipientName: certificate.recipientName,
    number: certificate.number,
    eventTitle: event.title,
    eventDate: formatCertificateDate(event.startAt, event.timezone),
    organizerName: event.organizer.orgName,
    signers: event.signers,
    issuedAt: certificate.issuedAt,
    revokedAt: certificate.revokedAt,
  };
}
