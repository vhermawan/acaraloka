import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { activeCapUsd, usdToMicros, wibDateString, wibMonthStart, type AiLimits } from "@/lib/ai-config";
import { aiThumbPath } from "@/lib/ai/paths";
import { env, getAiLimits } from "@/lib/env";
import { countGlobalToday, isCapReached } from "@/server/ai-quota";
import { prisma } from "@/server/db";
import { AI_BUCKET, createSignedUrls } from "@/server/storage";
import { reportCleanupFailure } from "@/server/storage-cleanup";

export const ADMIN_AI_RECENT_LIMIT = 50;
export const ADMIN_AI_THUMB_TTL_SECONDS = 300;

export type AdminAiStatus = "ACTIVE" | "DISABLED" | "PAUSED";

export type AdminAiSummary = {
  status: AdminAiStatus;
  capUsd: number;
  trial: boolean;
  trialEndsOn: string | null;
  spentUsd: number;
  spentPercent: number;
  todayCount: number;
  globalDailyLimit: number;
};

export type AdminAiOptions = {
  db?: PrismaClient;
  now?: Date;
  limits?: AiLimits;
  enabled?: boolean;
};

export async function getAdminAiSummary(options: AdminAiOptions = {}): Promise<AdminAiSummary> {
  const db = options.db ?? prisma;
  const now = options.now ?? new Date();
  const limits = options.limits ?? getAiLimits();
  const enabled = options.enabled ?? env.AI_ENABLED;

  const [spent, todayCount, capReached] = await Promise.all([
    db.aiGeneration.aggregate({ _sum: { costMicros: true }, where: { createdAt: { gte: wibMonthStart(now) } } }),
    countGlobalToday(db, now),
    isCapReached(db, now, limits),
  ]);

  const capUsd = activeCapUsd(now, limits);
  const spentMicros = spent._sum.costMicros ?? 0;
  const status: AdminAiStatus = !enabled ? "DISABLED" : capReached ? "PAUSED" : "ACTIVE";

  return {
    status,
    capUsd,
    trial: limits.trialEndsOn !== null && wibDateString(now) < limits.trialEndsOn,
    trialEndsOn: limits.trialEndsOn,
    spentUsd: spentMicros / 1_000_000,
    spentPercent: (spentMicros / usdToMicros(capUsd)) * 100,
    todayCount,
    globalDailyLimit: limits.globalDailyLimit,
  };
}

export type AdminAiGenerationRow = {
  id: string;
  createdAt: Date;
  eventTitle: string | null;
  userName: string;
  userEmail: string;
  kind: string;
  status: string;
  failureCode: string | null;
  costUsd: number;
  thumbUrl: string | null;
  used: boolean;
  reported: boolean;
};

async function signThumbs(rows: { id: string; eventId: string | null; status: string; purgedAt: Date | null }[]) {
  const targets = rows.filter((row) => row.status === "SUCCEEDED" && row.eventId && !row.purgedAt);
  if (targets.length === 0) return { urls: new Map<string, string | null>(), failed: false };
  const paths = targets.map((row) => aiThumbPath(row.eventId as string, row.id));
  try {
    const signed = await createSignedUrls(AI_BUCKET, paths, ADMIN_AI_THUMB_TTL_SECONDS);
    return {
      urls: new Map(targets.map((row) => [row.id, signed.get(aiThumbPath(row.eventId as string, row.id)) ?? null])),
      failed: false,
    };
  } catch (error) {
    await reportCleanupFailure("admin.ai.thumbs", error, { bucket: AI_BUCKET });
    return { urls: new Map<string, string | null>(), failed: true };
  }
}

export async function listRecentAiGenerations(db: PrismaClient = prisma): Promise<{ rows: AdminAiGenerationRow[]; thumbsFailed: boolean }> {
  const rows = await db.aiGeneration.findMany({
    orderBy: { createdAt: "desc" },
    take: ADMIN_AI_RECENT_LIMIT,
    select: {
      id: true,
      eventId: true,
      kind: true,
      status: true,
      failureCode: true,
      costMicros: true,
      firstUsedAt: true,
      reportedAt: true,
      purgedAt: true,
      createdAt: true,
      event: { select: { title: true } },
      user: { select: { name: true, email: true } },
    },
  });
  const thumbs = await signThumbs(rows);

  const mapped = rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt,
    eventTitle: row.event?.title ?? null,
    userName: row.user.name,
    userEmail: row.user.email,
    kind: row.kind,
    status: row.status,
    failureCode: row.failureCode,
    costUsd: row.costMicros / 1_000_000,
    thumbUrl: thumbs.urls.get(row.id) ?? null,
    used: row.firstUsedAt !== null,
    reported: row.reportedAt !== null,
  }));
  return { rows: mapped, thumbsFailed: thumbs.failed };
}

export type AdminAiAllowlistRow = {
  userId: string;
  name: string;
  email: string;
  createdAt: Date;
  generationCount: number;
};

export async function listAiAllowlist(db: PrismaClient = prisma): Promise<AdminAiAllowlistRow[]> {
  const entries = await db.aiAllowlist.findMany({
    orderBy: { createdAt: "desc" },
    select: { userId: true, createdAt: true, user: { select: { name: true, email: true } } },
  });
  if (entries.length === 0) return [];

  const counts = await db.aiGeneration.groupBy({
    by: ["userId"],
    where: { userId: { in: entries.map((entry) => entry.userId) } },
    _count: { _all: true },
  });
  const countByUser = new Map(counts.map((row) => [row.userId, row._count._all]));

  return entries.map((entry) => ({
    userId: entry.userId,
    name: entry.user.name,
    email: entry.user.email,
    createdAt: entry.createdAt,
    generationCount: countByUser.get(entry.userId) ?? 0,
  }));
}
