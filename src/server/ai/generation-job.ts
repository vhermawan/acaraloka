import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { storedInputSchema } from "@/lib/ai/generate-input";
import { aiDesignBriefSchema, withReadableText, type AiDesignBrief, type BriefInput } from "@/lib/ai/design-brief";
import { LAYOUT_PRESETS } from "@/lib/ai/layout-presets";
import { resultPathsFor } from "@/lib/ai/paths";
import { presetBriefFor } from "@/lib/ai/style-presets";
import {
  BACKGROUND_MAX_BYTES,
  hasBackgroundSignature,
  validateBackgroundDimensions,
  validateBackgroundFile,
} from "@/lib/certificate-background";
import { getAiLimits } from "@/lib/env";
import { buildBrief, type BriefOutcome } from "@/server/ai/brief";
import { getImageProvider, getTextProvider } from "@/server/ai/config";
import { toProviderError } from "@/server/ai/errors";
import { ImageOpsError, makeThumbnail, normalizeCertificate, sampleAverageColor } from "@/server/ai/image-ops";
import { IMAGE_PROMPT_VERSION } from "@/server/ai/prompts/image";
import { runWithRetry } from "@/server/ai/retry";
import type { ImageProvider, ImageResult, TextProvider } from "@/server/ai/types";
import { prisma } from "@/server/db";
import { recordError } from "@/server/error-log";
import { AI_BUCKET, removeObjects, uploadObject } from "@/server/storage";

export type JobDeps = {
  db: PrismaClient;
  textProvider: () => TextProvider;
  imageProvider: () => ImageProvider;
  upload: (path: string, body: Uint8Array, contentType: string) => Promise<void>;
  remove: (paths: string[]) => Promise<void>;
  now: () => number;
  deadlineMs: number;
};

export function defaultJobDeps(): JobDeps {
  return {
    db: prisma,
    textProvider: getTextProvider,
    imageProvider: getImageProvider,
    upload: (path, body, contentType) => uploadObject(AI_BUCKET, path, body, contentType),
    remove: (paths) => removeObjects(AI_BUCKET, paths),
    now: Date.now,
    deadlineMs: getAiLimits().deadlineMs,
  };
}

type Failure = {
  status: "FAILED" | "REJECTED";
  code: string;
  costMicros: number;
  brief?: BriefOutcome;
  provider?: ImageProvider;
};

const TIMEOUT_PATTERN = /timeout|deadline|aborted/i;

export function classifyImageFailure(error: unknown, hasNote: boolean): Pick<Failure, "status" | "code"> & {
  record: "error" | "warn" | null;
} {
  const failure = toProviderError(error);
  if (failure.kind === "SAFETY") {
    return hasNote
      ? { status: "REJECTED", code: "VENDOR_SAFETY", record: null }
      : { status: "FAILED", code: "VENDOR_SAFETY", record: "warn" };
  }
  if (failure.kind === "CONFIG") return { status: "FAILED", code: "VENDOR_CONFIG", record: "error" };
  if (failure.isCapacity) return { status: "FAILED", code: "VENDOR_CAPACITY", record: null };
  if (TIMEOUT_PATTERN.test(failure.message)) return { status: "FAILED", code: "TIMEOUT", record: null };
  return { status: "FAILED", code: "VENDOR_ERROR", record: "warn" };
}

function presetOutcome(input: BriefInput, fallbackReason: BriefOutcome["fallbackReason"] & string): BriefOutcome {
  return {
    source: "PRESET",
    brief: presetBriefFor(input.style, input.primaryColor),
    costMicros: 0,
    fallbackReason,
  };
}

async function executeGeneration(generationId: string, deps: JobDeps): Promise<void> {
  const { db } = deps;
  const row = await db.aiGeneration.findUnique({
    where: { id: generationId },
    select: {
      id: true,
      eventId: true,
      status: true,
      input: true,
      startedAt: true,
      event: { select: { title: true } },
    },
  });
  if (!row || row.status !== "RUNNING" || !row.eventId || !row.event) return;
  const eventId = row.eventId;

  const stored = storedInputSchema.safeParse(row.input);
  const alive = async (phase: string) => {
    const moved = await db.aiGeneration.updateMany({ where: { id: row.id, status: "RUNNING" }, data: { phase } });
    return moved.count === 1;
  };
  const finish = async (failure: Failure) => {
    await db.aiGeneration.updateMany({
      where: { id: row.id, status: "RUNNING" },
      data: {
        status: failure.status,
        failureCode: failure.code,
        costMicros: failure.costMicros,
        finishedAt: new Date(deps.now()),
        briefSource: failure.brief?.source,
        brief: failure.brief ? (failure.brief.brief as Prisma.InputJsonValue) : undefined,
        provider: failure.provider?.id,
        model: failure.provider?.model,
      },
    });
  };
  const report = (source: string, error: unknown, level: "error" | "warn") =>
    recordError({ source, level, error, context: { generationId: row.id, eventId } }).catch(() => undefined);

  if (!stored.success) {
    await finish({ status: "FAILED", code: "INVALID_OUTPUT", costMicros: 0 });
    await report("ai.generation.input", new Error("Stored generation input is invalid"), "error");
    return;
  }

  const input: BriefInput = {
    eventTitle: row.event.title,
    style: stored.data.style,
    primaryColor: stored.data.colorHex,
    hasLogo: false,
    organizerNote: stored.data.note,
  };
  const hasNote = stored.data.note.length > 0;
  const deadlineAt = row.startedAt.getTime() + deps.deadlineMs;
  let briefOutcome: BriefOutcome | undefined;
  let provider: ImageProvider | undefined;
  const uploaded: string[] = [];

  try {
    if (!(await alive("BRIEF"))) return;
    try {
      briefOutcome = await buildBrief(input, deps.textProvider());
    } catch (error) {
      briefOutcome = presetOutcome(input, `PROVIDER_${toProviderError(error).kind}`);
    }

    if (!(await alive("IMAGE"))) return;
    let original: ImageResult;
    try {
      provider = deps.imageProvider();
      const request = {
        kind: "CERTIFICATE",
        aspect: "A4_LANDSCAPE",
        minWidth: 1754,
        spec: { style: input.style, brief: briefOutcome.brief },
      } as const;
      const activeProvider = provider;
      const generated = await runWithRetry((signal) => activeProvider.generate(request, { signal }), {
        deadlineAt,
        now: deps.now,
      });
      original = generated.value;
    } catch (error) {
      const verdict = classifyImageFailure(error, hasNote);
      await finish({ status: verdict.status, code: verdict.code, costMicros: briefOutcome.costMicros, brief: briefOutcome, provider });
      if (verdict.record) await report("ai.generation.image", error, verdict.record);
      return;
    }

    if (!(await alive("FINALIZE"))) return;
    let background: Uint8Array;
    let finalSize: { width: number; height: number };
    let finalBrief: AiDesignBrief;
    try {
      const normalized = await normalizeCertificate(original.bytes, BACKGROUND_MAX_BYTES);
      const invalid =
        validateBackgroundFile(normalized.mime, normalized.bytes.byteLength) ??
        (() => {
          const dimensions = validateBackgroundDimensions(normalized.width, normalized.height);
          return dimensions.ok ? null : dimensions.error;
        })() ??
        (hasBackgroundSignature(normalized.bytes, "jpg") ? null : "Signature JPEG tidak valid");
      if (invalid) throw new ImageOpsError(invalid, "UNREADABLE");

      background = normalized.bytes;
      finalSize = { width: normalized.width, height: normalized.height };
      const preset = LAYOUT_PRESETS[briefOutcome.brief.layoutPreset];
      const sample = await sampleAverageColor(background, preset.safeArea);
      finalBrief = aiDesignBriefSchema.parse(withReadableText(briefOutcome.brief, sample).brief);
    } catch (error) {
      const cost = briefOutcome.costMicros + original.costMicros;
      await finish({ status: "FAILED", code: "INVALID_OUTPUT", costMicros: cost, brief: briefOutcome, provider });
      await report("ai.generation.finalize", error, "warn");
      return;
    }

    const [resultPath, thumbPath] = resultPathsFor(eventId, row.id);
    const thumbnail = await makeThumbnail(background);
    await deps.upload(resultPath, background, "image/jpeg");
    uploaded.push(resultPath);
    await deps.upload(thumbPath, thumbnail, "image/jpeg");
    uploaded.push(thumbPath);

    const done = await db.aiGeneration.updateMany({
      where: { id: row.id, status: "RUNNING" },
      data: {
        status: "SUCCEEDED",
        brief: finalBrief as Prisma.InputJsonValue,
        briefSource: briefOutcome.source,
        promptVersion: IMAGE_PROMPT_VERSION,
        provider: provider.id,
        model: provider.model,
        costMicros: briefOutcome.costMicros + original.costMicros,
        resultPaths: [resultPath, thumbPath],
        width: finalSize.width,
        height: finalSize.height,
        finishedAt: new Date(deps.now()),
      },
    });
    if (done.count === 0) await deps.remove(uploaded).catch(() => undefined);
  } catch (error) {
    if (uploaded.length > 0) await deps.remove(uploaded).catch(() => undefined);
    await finish({
      status: "FAILED",
      code: "INTERNAL_ERROR",
      costMicros: briefOutcome?.costMicros ?? 0,
      brief: briefOutcome,
      provider,
    }).catch(() => undefined);
    await report("ai.generation.job", error, "error");
  }
}

export async function runGeneration(generationId: string, deps?: JobDeps): Promise<void> {
  try {
    await executeGeneration(generationId, deps ?? defaultJobDeps());
  } catch (error) {
    await (deps?.db ?? prisma).aiGeneration
      .updateMany({
        where: { id: generationId, status: "RUNNING" },
        data: { status: "FAILED", failureCode: "INTERNAL_ERROR", finishedAt: new Date() },
      })
      .catch(() => undefined);
    await recordError({ source: "ai.generation.job", level: "error", error, context: { generationId } }).catch(
      () => undefined,
    );
  }
}
