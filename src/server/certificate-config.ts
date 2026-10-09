import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import {
  BUILTIN_TEMPLATE_KEY,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  defaultCertificateLayout,
  parseCertificateLayout,
  type CertificateLayout,
} from "@/lib/certificate-layout";
import { CERTIFICATE_NUMBER_PREFIX } from "@/lib/brand";
import { env } from "@/lib/env";
import { pageSizeFor, type PageFormatKey } from "@/lib/certificate-background";
import type { CertificateRenderData, CertificateTemplate } from "@/server/certificate-pdf";
import { prisma } from "@/server/db";
import { CERTIFICATE_BACKGROUND_BUCKET, downloadObject, removeObjects } from "@/server/storage";

export async function getOrCreateCertificateConfig(eventId: string, db: PrismaClient = prisma) {
  const existing = await db.certificateConfig.findUnique({ where: { eventId } });
  if (existing) return { ...existing, layout: parseCertificateLayout(existing.layout) };

  const signerCount = await db.signer.count({ where: { eventId } });
  try {
    const created = await db.certificateConfig.create({
      data: {
        eventId,
        builtinKey: BUILTIN_TEMPLATE_KEY,
        pageWidth: PAGE_WIDTH,
        pageHeight: PAGE_HEIGHT,
        layout: defaultCertificateLayout(signerCount) as Prisma.InputJsonValue,
      },
    });
    return { ...created, layout: parseCertificateLayout(created.layout) };
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    const existingNow = await db.certificateConfig.findUniqueOrThrow({ where: { eventId } });
    return { ...existingNow, layout: parseCertificateLayout(existingNow.layout) };
  }
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

export type BackgroundChange = { ok: true } | { ok: false; reason: "LOCKED" };

export async function setCertificateBackground(
  eventId: string,
  input: { path: string; format: PageFormatKey },
  db: PrismaClient = prisma,
): Promise<BackgroundChange> {
  const current = await getOrCreateCertificateConfig(eventId, db);
  const { width, height } = pageSizeFor(input.format);
  const updated = await db.certificateConfig.updateMany({
    where: { eventId, lockedAt: null },
    data: { templateSource: "UPLOAD", backgroundPath: input.path, pageWidth: width, pageHeight: height },
  });
  if (updated.count !== 1) return { ok: false, reason: "LOCKED" };
  if (current.backgroundPath && current.backgroundPath !== input.path) {
    await removeObjects(CERTIFICATE_BACKGROUND_BUCKET, [current.backgroundPath]).catch(() => undefined);
  }
  return { ok: true };
}

export async function clearCertificateBackground(eventId: string, db: PrismaClient = prisma): Promise<BackgroundChange> {
  const current = await getOrCreateCertificateConfig(eventId, db);
  const { width, height } = pageSizeFor("a4");
  const updated = await db.certificateConfig.updateMany({
    where: { eventId, lockedAt: null },
    data: { templateSource: "BUILTIN", backgroundPath: null, pageWidth: width, pageHeight: height },
  });
  if (updated.count !== 1) return { ok: false, reason: "LOCKED" };
  if (current.backgroundPath) {
    await removeObjects(CERTIFICATE_BACKGROUND_BUCKET, [current.backgroundPath]).catch(() => undefined);
  }
  return { ok: true };
}

export async function loadCertificateTemplate(config: {
  templateSource: string;
  backgroundPath: string | null;
  pageWidth: number;
  pageHeight: number;
}): Promise<CertificateTemplate> {
  const background =
    config.templateSource === "UPLOAD" && config.backgroundPath
      ? {
          path: config.backgroundPath,
          bytes: await downloadObject(CERTIFICATE_BACKGROUND_BUCKET, config.backgroundPath),
        }
      : null;
  return { pageWidth: config.pageWidth, pageHeight: config.pageHeight, background };
}

export function formatCertificateDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: timezone }).format(
    date,
  );
}

export function verifyUrl(certificateNumber: string): string {
  return new URL(`/v/${encodeURIComponent(certificateNumber)}`, env.APP_BASE_URL).toString();
}

export const SAMPLE_CERTIFICATE_NUMBER = `${CERTIFICATE_NUMBER_PREFIX}-0000-0001-CONTOH`;

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
