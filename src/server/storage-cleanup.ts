import "server-only";

import { recordError } from "@/server/error-log";
import { removeObjects } from "@/server/storage";

export async function reportCleanupFailure(source: string, error: unknown, context: Record<string, string>) {
  console.error(`[${source}]`, error);
  await recordError({ source, level: "warn", error, context }).catch(() => undefined);
}

export async function removeObjectsQuietly(source: string, bucket: string, paths: string[]): Promise<void> {
  try {
    await removeObjects(bucket, paths);
  } catch (error) {
    await reportCleanupFailure(source, error, { bucket, paths: paths.join(",") });
  }
}
