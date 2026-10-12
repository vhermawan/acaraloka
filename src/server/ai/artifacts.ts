import "server-only";

import { AI_ORPHAN_UPLOAD_MS } from "@/lib/ai-config";
import { isAiLogoPathFor, isAiRawLogoPathFor } from "@/lib/ai/paths";
import { AI_BUCKET, listObjectEntries, removeObjects } from "@/server/storage";
import { removeObjectsQuietly, reportCleanupFailure } from "@/server/storage-cleanup";

const eventPrefix = (eventId: string) => `events/${eventId}`;

export async function countEventLogos(eventId: string): Promise<number> {
  const entries = await listObjectEntries(AI_BUCKET, eventPrefix(eventId));
  return entries.filter((entry) => isAiLogoPathFor(eventId, entry.path)).length;
}

export async function sweepOrphanUploads(eventId: string, now: Date = new Date()): Promise<void> {
  try {
    const entries = await listObjectEntries(AI_BUCKET, eventPrefix(eventId));
    const stale = entries
      .filter(
        (entry) =>
          isAiRawLogoPathFor(eventId, entry.path) &&
          entry.createdAt !== null &&
          now.getTime() - entry.createdAt.getTime() > AI_ORPHAN_UPLOAD_MS,
      )
      .map((entry) => entry.path);
    await removeObjects(AI_BUCKET, stale);
  } catch (error) {
    await reportCleanupFailure("ai.logo.sweep", error, { eventId });
  }
}

export async function deleteEventLogo(eventId: string, path: string): Promise<boolean> {
  if (!isAiLogoPathFor(eventId, path)) return false;
  await removeObjectsQuietly("ai.logo.delete", AI_BUCKET, [path]);
  return true;
}

export async function removeAiEventArtifacts(eventId: string): Promise<void> {
  try {
    const entries = await listObjectEntries(AI_BUCKET, eventPrefix(eventId));
    await removeObjects(
      AI_BUCKET,
      entries.map((entry) => entry.path),
    );
  } catch (error) {
    await reportCleanupFailure("event.delete.ai", error, { eventId });
  }
}
