import "server-only";

import { AiProviderError, toProviderError } from "@/server/ai/errors";

export const RETRY_MIN_REMAINING_MS = 20_000;

export type RetryOptions = {
  deadlineAt: number;
  now?: () => number;
  minRemainingMs?: number;
};

export async function runWithRetry<T>(
  run: (signal: AbortSignal) => Promise<T>,
  options: RetryOptions,
): Promise<{ value: T; attempts: number }> {
  const now = options.now ?? Date.now;
  const minRemaining = options.minRemainingMs ?? RETRY_MIN_REMAINING_MS;

  for (let attempt = 1; ; attempt += 1) {
    const remaining = options.deadlineAt - now();
    if (remaining <= 0) {
      const expired = new AiProviderError("Generation deadline reached", "RETRYABLE");
      expired.attempts = attempt - 1;
      throw expired;
    }
    try {
      const value = await run(AbortSignal.timeout(remaining));
      return { value, attempts: attempt };
    } catch (error) {
      const failure = toProviderError(error);
      failure.attempts = attempt;
      const canRetry = failure.kind === "RETRYABLE" && attempt === 1 && options.deadlineAt - now() >= minRemaining;
      if (!canRetry) throw failure;
    }
  }
}
