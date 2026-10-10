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
import { PDFDocument } from "pdf-lib";

import {
  BACKGROUND_MAX_BYTES,
  backgroundFormat,
  hasBackgroundSignature,
  isBackgroundPath,
  isBackgroundPathFor,
  pageSizeFor,
  validateBackgroundDimensions,
  type PageFormatKey,
} from "@/lib/certificate-background";
import { BackgroundUnavailableError } from "@/server/certificate-background-error";
import type { CertificateRenderData, CertificateTemplate } from "@/server/certificate-pdf";
import { prisma } from "@/server/db";
import { CERTIFICATE_BACKGROUND_BUCKET, downloadObject, listObjects, removeObjects } from "@/server/storage";
import { removeObjectsQuietly, reportCleanupFailure } from "@/server/storage-cleanup";

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

export async function pruneCertificateBackgrounds(eventId: string, keepPath: string | null): Promise<void> {
  try {
    const existing = await listObjects(CERTIFICATE_BACKGROUND_BUCKET, `events/${eventId}`);
    const stale = existing.filter((path) => path !== keepPath);
    await removeObjects(CERTIFICATE_BACKGROUND_BUCKET, stale);
  } catch (error) {
    await reportCleanupFailure("certificate-background.prune", error, { eventId });
  }
}

async function pruneToActiveBackground(eventId: string, db: PrismaClient) {
  let active: string | null;
  try {
    const config = await db.certificateConfig.findUnique({ where: { eventId }, select: { backgroundPath: true } });
    active = config?.backgroundPath ?? null;
  } catch (error) {
    await reportCleanupFailure("certificate-background.prune", error, { eventId });
    return;
  }
  await pruneCertificateBackgrounds(eventId, active);
}

export type BackgroundChange = { ok: true } | { ok: false; reason: "LOCKED" };

export async function setCertificateBackground(
  eventId: string,
  input: { path: string; format: PageFormatKey },
  db: PrismaClient = prisma,
): Promise<BackgroundChange> {
  await getOrCreateCertificateConfig(eventId, db);
  const { width, height } = pageSizeFor(input.format);
  const result = await db.$transaction(async (tx) => {
    const updated = await tx.certificateConfig.updateMany({
      where: { eventId, lockedAt: null },
      data: { templateSource: "UPLOAD", backgroundPath: input.path, pageWidth: width, pageHeight: height },
    });
    return { updated: updated.count === 1 };
  });
  if (!result.updated) return { ok: false, reason: "LOCKED" };
  await pruneToActiveBackground(eventId, db);
  return { ok: true };
}

export async function clearCertificateBackground(eventId: string, db: PrismaClient = prisma): Promise<BackgroundChange> {
  await getOrCreateCertificateConfig(eventId, db);
  const { width, height } = pageSizeFor("a4");
  const result = await db.$transaction(async (tx) => {
    const updated = await tx.certificateConfig.updateMany({
      where: { eventId, lockedAt: null },
      data: { templateSource: "BUILTIN", backgroundPath: null, pageWidth: width, pageHeight: height },
    });
    return { updated: updated.count === 1 };
  });
  if (!result.updated) return { ok: false, reason: "LOCKED" };
  await pruneToActiveBackground(eventId, db);
  return { ok: true };
}

export type BackgroundApplyResult = { ok: true } | { ok: false; reason: "LOCKED" | "INVALID"; error: string };

export const BACKGROUND_LOCKED_MESSAGE = "Desain sudah terkunci. Buka kunci dulu untuk mengubah gambar latar.";

export async function applyCertificateBackground(
  eventId: string,
  path: string,
  db: PrismaClient = prisma,
): Promise<BackgroundApplyResult> {
  const reject = async (error: string): Promise<BackgroundApplyResult> => {
    if (isBackgroundPathFor(eventId, path)) {
      await removeObjectsQuietly("certificate-background.reject", CERTIFICATE_BACKGROUND_BUCKET, [path]);
    }
    return { ok: false, reason: "INVALID", error };
  };

  if (!isBackgroundPathFor(eventId, path)) return { ok: false, reason: "INVALID", error: "Berkas gambar latar tidak valid." };
  const extension = backgroundFormat(path);

  let bytes: Uint8Array;
  try {
    bytes = await downloadObject(CERTIFICATE_BACKGROUND_BUCKET, path);
  } catch {
    return { ok: false, reason: "INVALID", error: "Gambar latar belum terunggah. Coba unggah lagi." };
  }
  if (bytes.byteLength === 0 || bytes.byteLength > BACKGROUND_MAX_BYTES) return reject("Ukuran gambar latar maksimal 3 MB.");
  if (!hasBackgroundSignature(bytes, extension)) return reject("Isi berkas bukan gambar PNG atau JPG yang valid.");

  let size: { width: number; height: number };
  try {
    const probe = await PDFDocument.create();
    const image = extension === "png" ? await probe.embedPng(bytes) : await probe.embedJpg(bytes);
    size = { width: image.width, height: image.height };
  } catch {
    return reject("Gambar tidak bisa dibaca. Coba berkas PNG atau JPG lain.");
  }

  const dimensions = validateBackgroundDimensions(size.width, size.height);
  if (!dimensions.ok) return reject(dimensions.error);

  const result = await setCertificateBackground(eventId, { path, format: dimensions.format }, db);
  if (!result.ok) {
    await removeObjectsQuietly("certificate-background.reject", CERTIFICATE_BACKGROUND_BUCKET, [path]);
    return { ok: false, reason: "LOCKED", error: BACKGROUND_LOCKED_MESSAGE };
  }
  return { ok: true };
}

export async function loadCertificateTemplate(config: {
  templateSource: string;
  backgroundPath: string | null;
  pageWidth: number;
  pageHeight: number;
}): Promise<CertificateTemplate> {
  if (config.templateSource !== "UPLOAD" || !config.backgroundPath) {
    return { pageWidth: config.pageWidth, pageHeight: config.pageHeight, background: null };
  }
  const path = config.backgroundPath;
  if (!isBackgroundPath(path)) throw new BackgroundUnavailableError();
  const bytes = await downloadObject(CERTIFICATE_BACKGROUND_BUCKET, path).catch(() => {
    throw new BackgroundUnavailableError();
  });
  return { pageWidth: config.pageWidth, pageHeight: config.pageHeight, background: { path, bytes } };
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
