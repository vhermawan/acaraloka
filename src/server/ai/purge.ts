import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { resultPathsFor } from "@/lib/ai/paths";
import { AI_BUCKET, listObjects, removeObjects } from "@/server/storage";
import { reportCleanupFailure } from "@/server/storage-cleanup";

export const AI_PURGE_AFTER_EVENT_MS = 30 * 24 * 60 * 60 * 1000;
export const AI_PURGE_LOGO_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
export const AI_PURGE_FAILED_GRACE_MS = 24 * 60 * 60 * 1000;
export const AI_PURGE_MAX_OBJECTS = 200;
const LOGO_EVENTS_PER_RUN = 100;
const LOGO_OBJECT = /\/(logo-[0-9a-f]{16}\.png|upload-[0-9a-f]{16}\.(png|jpg))$/;

export type AiPurgeOptions = { now?: Date; eventIds?: string[] };

export type AiPurgeResult = {
  unusedResults: number;
  failedRows: number;
  logoObjects: number;
  objectsRemoved: number;
};

async function purgeUnusedResults(db: PrismaClient, now: Date, budget: number, eventIds?: string[]): Promise<{ rows: number; objects: number }> {
  const rows = await db.aiGeneration.findMany({
    where: {
      status: "SUCCEEDED",
      firstUsedAt: null,
      purgedAt: null,
      certificateConfigs: { none: {} },
      event: { endAt: { lt: new Date(now.getTime() - AI_PURGE_AFTER_EVENT_MS) }, ...(eventIds ? { id: { in: eventIds } } : {}) },
    },
    select: { id: true, eventId: true },
    orderBy: { createdAt: "asc" },
    take: Math.floor(budget / 2),
  });

  const claimed: { id: string; eventId: string }[] = [];
  for (const row of rows) {
    if (!row.eventId) continue;
    const { count } = await db.aiGeneration.updateMany({
      where: { id: row.id, status: "SUCCEEDED", firstUsedAt: null, purgedAt: null },
      data: { purgedAt: now },
    });
    if (count === 1) claimed.push({ id: row.id, eventId: row.eventId });
  }
  if (claimed.length === 0) return { rows: 0, objects: 0 };

  const paths = claimed.flatMap((row) => resultPathsFor(row.eventId, row.id));
  try {
    await removeObjects(AI_BUCKET, paths);
  } catch (error) {
    await db.aiGeneration.updateMany({ where: { id: { in: claimed.map((row) => row.id) } }, data: { purgedAt: null } });
    await reportCleanupFailure("ai.purge.results", error, { paths: paths.join(",") });
    return { rows: 0, objects: 0 };
  }
  return { rows: claimed.length, objects: paths.length };
}

async function purgeFailedRows(db: PrismaClient, now: Date, budget: number, eventIds?: string[]): Promise<{ rows: number; objects: number }> {
  const rows = await db.aiGeneration.findMany({
    where: {
      status: "FAILED",
      purgedAt: null,
      eventId: eventIds ? { in: eventIds } : { not: null },
      createdAt: { lt: new Date(now.getTime() - AI_PURGE_FAILED_GRACE_MS) },
    },
    select: { id: true, eventId: true },
    orderBy: { createdAt: "asc" },
    take: Math.floor(budget / 2),
  });
  if (rows.length === 0) return { rows: 0, objects: 0 };

  const paths = rows.flatMap((row) => (row.eventId ? resultPathsFor(row.eventId, row.id) : []));
  try {
    await removeObjects(AI_BUCKET, paths);
  } catch (error) {
    await reportCleanupFailure("ai.purge.failed", error, { paths: paths.join(",") });
    return { rows: 0, objects: 0 };
  }
  await db.aiGeneration.updateMany({ where: { id: { in: rows.map((row) => row.id) }, purgedAt: null }, data: { purgedAt: now } });
  return { rows: rows.length, objects: paths.length };
}

async function purgeEndedEventLogos(db: PrismaClient, now: Date, budget: number, eventIds?: string[]): Promise<number> {
  const events = await db.event.findMany({
    where: {
      endAt: {
        lt: new Date(now.getTime() - AI_PURGE_AFTER_EVENT_MS),
        gt: new Date(now.getTime() - AI_PURGE_LOGO_WINDOW_MS),
      },
      aiGenerations: { some: {}, none: { OR: [{ firstUsedAt: { not: null } }, { certificateConfigs: { some: {} } }] } },
      ...(eventIds ? { id: { in: eventIds } } : {}),
    },
    select: { id: true },
    orderBy: { endAt: "desc" },
    take: LOGO_EVENTS_PER_RUN,
  });

  let removed = 0;
  for (const event of events) {
    const remaining = budget - removed;
    if (remaining <= 0) break;
    try {
      const objects = await listObjects(AI_BUCKET, `events/${event.id}`);
      const logos = objects.filter((path) => LOGO_OBJECT.test(path)).slice(0, remaining);
      await removeObjects(AI_BUCKET, logos);
      removed += logos.length;
    } catch (error) {
      await reportCleanupFailure("ai.purge.logos", error, { eventId: event.id });
    }
  }
  return removed;
}

export async function purgeAiArtifacts(db: PrismaClient, options: AiPurgeOptions = {}): Promise<AiPurgeResult> {
  const now = options.now ?? new Date();
  const { eventIds } = options;
  const result: AiPurgeResult = { unusedResults: 0, failedRows: 0, logoObjects: 0, objectsRemoved: 0 };
  const left = () => AI_PURGE_MAX_OBJECTS - result.objectsRemoved;

  try {
    const step = await purgeUnusedResults(db, now, left(), eventIds);
    result.unusedResults = step.rows;
    result.objectsRemoved += step.objects;
  } catch (error) {
    await reportCleanupFailure("ai.purge.results", error, {});
  }

  if (left() >= 2) {
    try {
      const step = await purgeFailedRows(db, now, left(), eventIds);
      result.failedRows = step.rows;
      result.objectsRemoved += step.objects;
    } catch (error) {
      await reportCleanupFailure("ai.purge.failed", error, {});
    }
  }

  if (left() > 0) {
    try {
      result.logoObjects = await purgeEndedEventLogos(db, now, left(), eventIds);
      result.objectsRemoved += result.logoObjects;
    } catch (error) {
      await reportCleanupFailure("ai.purge.logos", error, {});
    }
  }

  return result;
}
