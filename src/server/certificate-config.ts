import "server-only";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import {
  BUILTIN_TEMPLATE_KEY,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  defaultCertificateLayout,
  parseCertificateLayout,
  type CertificateLayout,
} from "@/lib/certificate-layout";
import { env } from "@/lib/env";
import type { CertificateRenderData } from "@/server/certificate-pdf";
import { prisma } from "@/server/db";

export async function getOrCreateCertificateConfig(eventId: string, db: PrismaClient = prisma) {
  const existing = await db.certificateConfig.findUnique({ where: { eventId } });
  if (existing) return { ...existing, layout: parseCertificateLayout(existing.layout) };

  const signerCount = await db.signer.count({ where: { eventId } });
  const created = await db.certificateConfig.upsert({
    where: { eventId },
    create: {
      eventId,
      builtinKey: BUILTIN_TEMPLATE_KEY,
      pageWidth: PAGE_WIDTH,
      pageHeight: PAGE_HEIGHT,
      layout: defaultCertificateLayout(signerCount) as Prisma.InputJsonValue,
    },
    update: {},
  });
  return { ...created, layout: parseCertificateLayout(created.layout) };
}

export async function saveCertificateLayout(
  eventId: string,
  layout: CertificateLayout,
  db: PrismaClient = prisma,
): Promise<boolean> {
  await getOrCreateCertificateConfig(eventId, db);
  const updated = await db.certificateConfig.updateMany({
    where: { eventId, lockedAt: null },
    data: { layout: layout as Prisma.InputJsonValue },
  });
  return updated.count === 1;
}

export function formatCertificateDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: timezone }).format(
    date,
  );
}

export function verifyUrl(certificateNumber: string): string {
  return new URL(`/v/${encodeURIComponent(certificateNumber)}`, env.APP_BASE_URL).toString();
}

export const SAMPLE_CERTIFICATE_NUMBER = "EI-0000-0001-CONTOH";

export function sampleRenderData(
  event: { title: string; startAt: Date; timezone: string },
  organizerName: string,
  signers: { name: string; title: string; signaturePng?: Uint8Array | null }[],
): CertificateRenderData {
  return {
    recipientName: "Nama Lengkap Peserta",
    certificateNumber: SAMPLE_CERTIFICATE_NUMBER,
    eventTitle: event.title,
    eventDate: formatCertificateDate(event.startAt, event.timezone),
    organizerName,
    verifyUrl: verifyUrl(SAMPLE_CERTIFICATE_NUMBER),
    signers: (signers.length > 0 ? signers : [{ name: "Nama Penandatangan", title: "Jabatan" }]).map((signer) => ({
      name: signer.name,
      title: signer.title,
      signaturePng: signer.signaturePng ?? null,
    })),
  };
}
