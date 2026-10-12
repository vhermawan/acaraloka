import "server-only";

import { randomBytes } from "node:crypto";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { AI_APPLY_MESSAGES, type AiApplyDenial } from "@/lib/ai-config";
import { aiDesignBriefSchema, toCertificateLayout } from "@/lib/ai/design-brief";
import { LAYOUT_PRESETS } from "@/lib/ai/layout-presets";
import { isAiLogoPathFor } from "@/lib/ai/paths";
import { BACKGROUND_MAX_BYTES, pageSizeFor } from "@/lib/certificate-background";
import { parseCertificateLayout } from "@/lib/certificate-layout";
import { compositeLogo } from "@/server/ai/image-ops";
import {
  getOrCreateCertificateConfig,
  pruneToActiveBackground,
  validateBackgroundObject,
} from "@/server/certificate-config";
import { prisma } from "@/server/db";
import { recordError } from "@/server/error-log";
import {
  AI_BUCKET,
  CERTIFICATE_BACKGROUND_BUCKET,
  downloadObject,
  uploadObject,
} from "@/server/storage";
import { removeObjectsQuietly } from "@/server/storage-cleanup";

export type ApplyDesignResult = { ok: true } | { ok: false; reason: AiApplyDenial; message: string };

class Abort extends Error {
  constructor(readonly reason: AiApplyDenial) {
    super(reason);
  }
}

function denied(reason: AiApplyDenial): ApplyDesignResult {
  return { ok: false, reason, message: AI_APPLY_MESSAGES[reason] };
}

export async function applyAiDesign(
  eventId: string,
  generationId: string,
  logoPath: string | null,
  options: { confirmReplace?: boolean } = {},
  db: PrismaClient = prisma,
): Promise<ApplyDesignResult> {
  if (logoPath !== null && !isAiLogoPathFor(eventId, logoPath)) return denied("INVALID");

  const generation = await db.aiGeneration.findFirst({
    where: {
      id: generationId,
      eventId,
      kind: "CERTIFICATE",
      status: "SUCCEEDED",
      reportedAt: null,
      purgedAt: null,
    },
    select: { brief: true, resultPaths: true },
  });
  const brief = aiDesignBriefSchema.safeParse(generation?.brief);
  const sourcePath = generation?.resultPaths[0];
  if (!generation || !brief.success || !sourcePath) return denied("NOT_AVAILABLE");

  const config = await getOrCreateCertificateConfig(eventId, db);
  if (config.lockedAt) return denied("LOCKED");
  const replacesOtherDesign =
    config.templateSource === "UPLOAD" && config.backgroundPath !== null && config.aiGenerationId !== generationId;
  if (replacesOtherDesign && !options.confirmReplace) return denied("NEEDS_CONFIRM");

  const targetPath = `events/${eventId}/${randomBytes(8).toString("hex")}.jpg`;
  let uploaded = false;
  try {
    const [original, logo] = await Promise.all([
      downloadObject(AI_BUCKET, sourcePath),
      logoPath ? downloadObject(AI_BUCKET, logoPath) : Promise.resolve(null),
    ]);
    const slot = LAYOUT_PRESETS[brief.data.layoutPreset].logoSlot;
    const bytes = logo ? await compositeLogo(original, logo, slot, BACKGROUND_MAX_BYTES) : original;

    uploaded = true;
    await uploadObject(CERTIFICATE_BACKGROUND_BUCKET, targetPath, bytes, "image/jpeg");

    const validation = await validateBackgroundObject(eventId, targetPath);
    if (!validation.ok) throw new Abort("FAILED");
    const { width, height } = pageSizeFor(validation.format);

    await db.$transaction(
      async (tx) => {
        await tx.aiGeneration.updateMany({
          where: { id: generationId, eventId, reportedAt: null, firstUsedAt: null },
          data: { firstUsedAt: new Date() },
        });
        const usable = await tx.aiGeneration.count({
          where: { id: generationId, eventId, status: "SUCCEEDED", reportedAt: null, purgedAt: null },
        });
        if (usable === 0) throw new Abort("NOT_AVAILABLE");

        const current = await tx.certificateConfig.findUnique({
          where: { eventId },
          select: { aiGenerationId: true, layout: true },
        });
        const data: Prisma.CertificateConfigUncheckedUpdateManyInput = {
          templateSource: "UPLOAD",
          backgroundPath: targetPath,
          pageWidth: width,
          pageHeight: height,
          aiGenerationId: generationId,
        };
        const recompute = current?.aiGenerationId !== generationId;
        if (recompute) {
          const signerCount = await tx.signer.count({ where: { eventId } });
          data.layout = toCertificateLayout(
            brief.data,
            parseCertificateLayout(current?.layout),
            signerCount,
          ) as Prisma.InputJsonValue;
        }
        const updated = await tx.certificateConfig.updateMany({ where: { eventId, lockedAt: null }, data });
        if (updated.count !== 1) throw new Abort("LOCKED");
      },
      { maxWait: 15_000, timeout: 15_000 },
    );
  } catch (error) {
    if (uploaded) await removeObjectsQuietly("ai.apply.reject", CERTIFICATE_BACKGROUND_BUCKET, [targetPath]);
    if (error instanceof Abort) return denied(error.reason);
    await recordError({ source: "ai.apply", level: "error", error, context: { eventId, generationId } }).catch(
      () => undefined,
    );
    return denied("FAILED");
  }

  await pruneToActiveBackground(eventId, db);
  return { ok: true };
}
