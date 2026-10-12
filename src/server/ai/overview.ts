import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import {
  AI_FAILURE_MESSAGES,
  AI_QUOTA,
  failureKindFor,
  type AiPhase,
} from "@/lib/ai-config";
import { MAX_RESULT_HISTORY, DEFAULT_STYLE, storedInputSchema, type StoredInput } from "@/lib/ai/generate-input";
import { isAiLogoPathFor } from "@/lib/ai/paths";
import { STYLE_LABELS } from "@/lib/ai/styles";
import { getAiAccess, type AiAccess } from "@/server/ai-access";
import { countAccountToday, countEventKind, sweepStaleGenerations } from "@/server/ai-quota";
import { prisma } from "@/server/db";
import { AI_BUCKET, createSignedUrls, listObjects } from "@/server/storage";
import { reportCleanupFailure } from "@/server/storage-cleanup";

export const AI_SIGNED_URL_TTL_SECONDS = 600;
const FAILURE_VISIBLE_MS = 30 * 60 * 1000;

export type AiResultItem = {
  id: string;
  createdAt: string;
  styleLabel: string;
  thumbUrl: string | null;
  used: boolean;
};
export type AiDesignState = {
  locked: boolean;
  hasCustomBackground: boolean;
  activeGenerationId: string | null;
};
export type AiLogoItem = { path: string; url: string | null };
export type AiFailureItem = { id: string; message: string };

export type AiOverview = {
  access: AiAccess;
  eventRemaining: number;
  dayRemaining: number;
  running: { id: string; phase: AiPhase | null } | null;
  failure: AiFailureItem | null;
  defaults: StoredInput;
  results: AiResultItem[];
  logos: AiLogoItem[];
  design: AiDesignState;
  reportAvailable: boolean;
};

const NO_DESIGN: AiDesignState = { locked: false, hasCustomBackground: false, activeGenerationId: null };

const FALLBACK_DEFAULTS: StoredInput = { style: DEFAULT_STYLE, colorHex: null, note: "" };

function phaseOf(value: string | null): AiPhase | null {
  return value === "BRIEF" || value === "IMAGE" || value === "FINALIZE" ? value : null;
}

export async function loadAiOverview(
  user: { id: string },
  event: { id: string },
  db: PrismaClient = prisma,
  now: Date = new Date(),
): Promise<AiOverview> {
  const access = await getAiAccess(user, { eventId: event.id, kind: "CERTIFICATE" }, { db, now });
  const empty: AiOverview = {
    access,
    eventRemaining: 0,
    dayRemaining: 0,
    running: null,
    failure: null,
    defaults: FALLBACK_DEFAULTS,
    results: [],
    logos: [],
    design: NO_DESIGN,
    reportAvailable: false,
  };
  if (access.status === "HIDDEN") return empty;

  await sweepStaleGenerations(db, now);

  const [eventCount, dayCount, running, latest, successes, config, reported] = await Promise.all([
    countEventKind(db, event.id, "CERTIFICATE"),
    countAccountToday(db, user.id, now),
    db.aiGeneration.findFirst({
      where: { eventId: event.id, kind: "CERTIFICATE", status: "RUNNING" },
      select: { id: true, phase: true },
    }),
    db.aiGeneration.findFirst({
      where: { eventId: event.id, kind: "CERTIFICATE", NOT: { failureCode: "BLOCKLIST" } },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, failureCode: true, finishedAt: true, input: true },
    }),
    db.aiGeneration.findMany({
      where: { eventId: event.id, kind: "CERTIFICATE", status: "SUCCEEDED", reportedAt: null, purgedAt: null },
      orderBy: { createdAt: "desc" },
      take: MAX_RESULT_HISTORY,
      select: { id: true, createdAt: true, resultPaths: true, input: true, firstUsedAt: true },
    }),
    db.certificateConfig.findUnique({
      where: { eventId: event.id },
      select: { lockedAt: true, templateSource: true, backgroundPath: true, aiGenerationId: true },
    }),
    db.aiGeneration.count({ where: { eventId: event.id, kind: "CERTIFICATE", reportedAt: { not: null } } }),
  ]);

  const logoPaths = await listObjects(AI_BUCKET, `events/${event.id}`)
    .then((paths) => paths.filter((path) => isAiLogoPathFor(event.id, path)).sort())
    .catch(async (error: unknown) => {
      await reportCleanupFailure("ai.overview.logos", error, { eventId: event.id });
      return [] as string[];
    });

  const thumbPaths = successes.map((row) => row.resultPaths[1]).filter((path): path is string => Boolean(path));
  const urls = await createSignedUrls(AI_BUCKET, [...thumbPaths, ...logoPaths], AI_SIGNED_URL_TTL_SECONDS).catch(
    async (error: unknown) => {
      await reportCleanupFailure("ai.overview.signed-urls", error, { eventId: event.id });
      return new Map<string, string>();
    },
  );

  const parsedDefaults = storedInputSchema.safeParse(latest?.input);
  const failureVisible =
    latest !== null &&
    (latest.status === "FAILED" || latest.status === "REJECTED") &&
    latest.finishedAt !== null &&
    now.getTime() - latest.finishedAt.getTime() < FAILURE_VISIBLE_MS;

  return {
    access,
    eventRemaining: Math.max(0, AI_QUOTA.perEventKind - eventCount),
    dayRemaining: Math.max(0, AI_QUOTA.perAccountDay - dayCount),
    running: running ? { id: running.id, phase: phaseOf(running.phase) } : null,
    failure:
      failureVisible && latest
        ? { id: latest.id, message: AI_FAILURE_MESSAGES[failureKindFor(latest.status, latest.failureCode)] }
        : null,
    defaults: parsedDefaults.success ? parsedDefaults.data : FALLBACK_DEFAULTS,
    results: successes.map((row) => {
      const input = storedInputSchema.safeParse(row.input);
      return {
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        styleLabel: input.success ? STYLE_LABELS[input.data.style] : "Desain AI",
        thumbUrl: (row.resultPaths[1] && urls.get(row.resultPaths[1])) || null,
        used: row.firstUsedAt !== null,
      };
    }),
    logos: logoPaths.map((path) => ({ path, url: urls.get(path) ?? null })),
    design: {
      locked: config?.lockedAt != null,
      hasCustomBackground: config?.templateSource === "UPLOAD" && config.backgroundPath !== null,
      activeGenerationId: config?.aiGenerationId ?? null,
    },
    reportAvailable: reported === 0,
  };
}
