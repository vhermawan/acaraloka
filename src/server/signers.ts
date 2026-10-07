import "server-only";

import { randomBytes } from "node:crypto";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { MAX_SIGNERS, parseCertificateLayout, spreadSigners } from "@/lib/certificate-layout";
import { SIGNER_LINK_TTL_MS, signerLinkState } from "@/lib/validation/signer";
import { getOrCreateCertificateConfig } from "@/server/certificate-config";
import { prisma } from "@/server/db";
import { generateSignerToken, hashSignerToken } from "@/server/signer-token";
import { SIGNATURE_BUCKET, downloadObject, removeObjects, uploadObject } from "@/server/storage";

export type SignatureStore = {
  upload: (path: string, body: Uint8Array) => Promise<void>;
  remove: (paths: string[]) => Promise<void>;
};

const supabaseSignatureStore: SignatureStore = {
  upload: (path, body) => uploadObject(SIGNATURE_BUCKET, path, body, "image/png"),
  remove: (paths) => removeObjects(SIGNATURE_BUCKET, paths),
};

function deadTokenHash() {
  return hashSignerToken(generateSignerToken());
}

function newLink(now: Date) {
  const token = generateSignerToken();
  return { token, tokenHash: hashSignerToken(token), tokenExpiresAt: new Date(now.getTime() + SIGNER_LINK_TTL_MS) };
}

async function respreadSigners(tx: Prisma.TransactionClient, eventId: string, count: number) {
  const config = await tx.certificateConfig.findUnique({ where: { eventId } });
  if (!config || config.lockedAt) return;
  const layout = spreadSigners(parseCertificateLayout(config.layout), count);
  await tx.certificateConfig.update({ where: { eventId }, data: { layout: layout as Prisma.InputJsonValue } });
}

async function isLocked(eventId: string, db: PrismaClient) {
  const config = await db.certificateConfig.findUnique({ where: { eventId }, select: { lockedAt: true } });
  return !!config?.lockedAt;
}

export type AddSignerResult = { ok: true; token: string } | { ok: false; reason: "LOCKED" | "FULL" };

export async function addSigner(
  input: { eventId: string; name: string; title: string; email: string },
  db: PrismaClient = prisma,
  now = new Date(),
): Promise<AddSignerResult> {
  if (await isLocked(input.eventId, db)) return { ok: false, reason: "LOCKED" };
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT 1 FROM "events" WHERE "id" = ${input.eventId} FOR UPDATE`;
    const count = await tx.signer.count({ where: { eventId: input.eventId } });
    if (count >= MAX_SIGNERS) return { ok: false, reason: "FULL" } as const;
    const link = newLink(now);
    await tx.signer.create({
      data: {
        eventId: input.eventId,
        order: count + 1,
        name: input.name,
        title: input.title,
        email: input.email,
        tokenHash: link.tokenHash,
        tokenExpiresAt: link.tokenExpiresAt,
      },
    });
    await respreadSigners(tx, input.eventId, count + 1);
    return { ok: true, token: link.token } as const;
  });
}

export async function regenerateSignerLink(
  input: { eventId: string; signerId: string; actorId: string },
  db: PrismaClient = prisma,
  now = new Date(),
): Promise<string | null> {
  const link = newLink(now);
  return db.$transaction(async (tx) => {
    const updated = await tx.signer.updateMany({
      where: { id: input.signerId, eventId: input.eventId, status: { not: "SIGNED" } },
      data: { tokenHash: link.tokenHash, tokenExpiresAt: link.tokenExpiresAt, status: "PENDING", declineReason: null },
    });
    if (updated.count === 0) return null;
    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        action: "signer.link_regenerated",
        entityType: "Signer",
        entityId: input.signerId,
        meta: { eventId: input.eventId },
      },
    });
    return link.token;
  });
}

export async function removeSigner(
  input: { eventId: string; signerId: string },
  db: PrismaClient = prisma,
): Promise<boolean> {
  if (await isLocked(input.eventId, db)) return false;
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT 1 FROM "events" WHERE "id" = ${input.eventId} FOR UPDATE`;
    const deleted = await tx.signer.deleteMany({
      where: { id: input.signerId, eventId: input.eventId, status: { not: "SIGNED" } },
    });
    if (deleted.count === 0) return false;
    const remaining = await tx.signer.findMany({ where: { eventId: input.eventId }, orderBy: { order: "asc" } });
    for (const [index, signer] of remaining.entries()) {
      if (signer.order !== index + 1) await tx.signer.update({ where: { id: signer.id }, data: { order: index + 1 } });
    }
    await respreadSigners(tx, input.eventId, remaining.length);
    return true;
  });
}

export type UnlockResult = { ok: true } | { ok: false; reason: "ISSUED" | "NOT_LOCKED" };

export async function unlockCertificate(
  input: { eventId: string; actorId: string },
  db: PrismaClient = prisma,
  store: SignatureStore = supabaseSignatureStore,
  now = new Date(),
): Promise<UnlockResult> {
  const result = await db.$transaction(async (tx) => {
    const config = await tx.certificateConfig.findUnique({ where: { eventId: input.eventId } });
    if (!config?.lockedAt) return { ok: false, reason: "NOT_LOCKED" } as const;
    if (config.firstIssuedAt) return { ok: false, reason: "ISSUED" } as const;

    const unlocked = await tx.certificateConfig.updateMany({
      where: { eventId: input.eventId, lockedAt: { not: null }, firstIssuedAt: null },
      data: { lockedAt: null },
    });
    if (unlocked.count === 0) return { ok: false, reason: "NOT_LOCKED" } as const;

    const signers = await tx.signer.findMany({ where: { eventId: input.eventId } });
    for (const signer of signers) {
      await tx.signer.update({
        where: { id: signer.id },
        data: {
          status: "PENDING",
          signaturePath: null,
          consentAt: null,
          consentIp: null,
          consentUserAgent: null,
          signedByEmail: null,
          declineReason: null,
          tokenHash: deadTokenHash(),
          tokenExpiresAt: now,
        },
      });
    }
    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        action: "certificate.unlocked",
        entityType: "Event",
        entityId: input.eventId,
        meta: { resetSigners: signers.length },
      },
    });
    return { ok: true, paths: signers.flatMap((signer) => (signer.signaturePath ? [signer.signaturePath] : [])) } as const;
  });

  if (!result.ok) return result;
  await store.remove(result.paths).catch(() => undefined);
  return { ok: true };
}

export async function findSignerByToken(token: string, db: PrismaClient = prisma) {
  if (!token || token.length > 100) return null;
  return db.signer.findUnique({
    where: { tokenHash: hashSignerToken(token) },
    include: {
      event: {
        select: {
          id: true,
          title: true,
          startAt: true,
          timezone: true,
          status: true,
          organizer: { select: { orgName: true } },
        },
      },
    },
  });
}

export function canSign(
  signer: { status: string; tokenExpiresAt: Date; event: { status: string } },
  now = new Date(),
): boolean {
  return signerLinkState(signer, now) === "ACTIVE" && !["CANCELLED", "DISABLED"].includes(signer.event.status);
}

export type SignResult = { ok: true } | { ok: false; reason: "INVALID_LINK" | "INVALID_IMAGE" };

export async function signWithToken(
  input: { token: string; signaturePng: Uint8Array; ip: string | null; userAgent: string | null },
  db: PrismaClient = prisma,
  store: SignatureStore = supabaseSignatureStore,
  now = new Date(),
): Promise<SignResult> {
  const signer = await findSignerByToken(input.token, db);
  if (!signer || !canSign(signer, now)) return { ok: false, reason: "INVALID_LINK" };

  await getOrCreateCertificateConfig(signer.eventId, db);
  const path = `${signer.eventId}/${signer.id}-${randomBytes(8).toString("hex")}.png`;
  await store.upload(path, input.signaturePng);

  const signed = await db.$transaction(async (tx) => {
    const updated = await tx.signer.updateMany({
      where: { id: signer.id, tokenHash: signer.tokenHash, status: "PENDING", tokenExpiresAt: { gt: now } },
      data: {
        status: "SIGNED",
        signaturePath: path,
        consentAt: now,
        consentIp: input.ip?.slice(0, 64) ?? null,
        consentUserAgent: input.userAgent?.slice(0, 300) ?? null,
      },
    });
    if (updated.count === 0) return false;
    await tx.certificateConfig.updateMany({
      where: { eventId: signer.eventId, lockedAt: null },
      data: { lockedAt: now },
    });
    return true;
  });

  if (!signed) {
    await store.remove([path]).catch(() => undefined);
    return { ok: false, reason: "INVALID_LINK" };
  }
  return { ok: true };
}

export async function declineWithToken(
  input: { token: string; reason: string },
  db: PrismaClient = prisma,
  now = new Date(),
): Promise<boolean> {
  const signer = await findSignerByToken(input.token, db);
  if (!signer || !canSign(signer, now)) return false;
  const updated = await db.signer.updateMany({
    where: { id: signer.id, tokenHash: signer.tokenHash, status: "PENDING", tokenExpiresAt: { gt: now } },
    data: { status: "DECLINED", declineReason: input.reason },
  });
  return updated.count === 1;
}

export async function loadSignerRenderData(eventId: string, db: PrismaClient = prisma) {
  const signers = await db.signer.findMany({ where: { eventId }, orderBy: { order: "asc" } });
  return Promise.all(
    signers.map(async (signer) => ({
      name: signer.name,
      title: signer.title,
      signaturePng:
        signer.status === "SIGNED" && signer.signaturePath
          ? await downloadObject(SIGNATURE_BUCKET, signer.signaturePath).catch(() => null)
          : null,
    })),
  );
}
