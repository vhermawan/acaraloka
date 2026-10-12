import "server-only";

import { unstable_rethrow } from "next/navigation";

import { recordError } from "@/server/error-log";

export const ACTION_ERROR_MESSAGE = "Terjadi kesalahan di server. Coba lagi beberapa saat.";

export const ACTION_FAILED = { error: ACTION_ERROR_MESSAGE } as const;

async function logActionError(source: string, error: unknown) {
  unstable_rethrow(error);
  await recordError({ source, error }).catch(() => undefined);
}

export async function runAction<T>(source: string, fallback: NoInfer<T>, run: () => Promise<NoInfer<T>>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    await logActionError(source, error);
    return fallback;
  }
}

export async function runLoggedAction<T>(source: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    await logActionError(source, error);
    throw error;
  }
}
