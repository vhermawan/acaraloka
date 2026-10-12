import "server-only";

export const AI_PROVIDER_ERROR_KINDS = ["RETRYABLE", "SAFETY", "CONFIG"] as const;

export type AiProviderErrorKind = (typeof AI_PROVIDER_ERROR_KINDS)[number];

export class AiProviderError extends Error {
  attempts = 1;

  constructor(
    message: string,
    readonly kind: AiProviderErrorKind,
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = "AiProviderError";
  }

  get isCapacity(): boolean {
    return this.status === 429;
  }
}

export function redact(message: string): string {
  return message
    .replace(/-----BEGIN[\s\S]*?-----END[^-]*-----/g, "[redacted-key]")
    .replace(/[A-Za-z0-9+/_=-]{48,}/g, "[redacted]")
    .replace(/projects\/[A-Za-z0-9_-]+/g, "projects/[redacted]")
    .replace(/[\w.+-]+@[\w-]+\.iam\.gserviceaccount\.com/g, "[redacted-sa]")
    .slice(0, 400);
}

function statusOf(error: unknown): number | null {
  if (typeof error !== "object" || error === null) return null;
  const record = error as { status?: unknown; code?: unknown; message?: unknown };
  for (const candidate of [record.status, record.code]) {
    if (typeof candidate === "number" && candidate >= 100 && candidate < 600) return candidate;
  }
  if (typeof record.message === "string") {
    const match = /"code"\s*:\s*(\d{3})/.exec(record.message);
    if (match) return Number(match[1]);
  }
  return null;
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return String(error);
}

const SAFETY_PATTERN = /safety|prohibited|blocked|recitation/i;

function hasSafetySignal(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const record = error as { finishReason?: unknown; blockReason?: unknown };
  return [record.finishReason, record.blockReason].some((value) => typeof value === "string" && SAFETY_PATTERN.test(value));
}

export function toProviderError(error: unknown): AiProviderError {
  if (error instanceof AiProviderError) return error;
  const status = statusOf(error);
  const raw = messageOf(error);
  const message = redact(raw);
  const name = error instanceof Error ? error.name : "";

  if (name === "TimeoutError" || name === "AbortError") return new AiProviderError(message, "RETRYABLE", status);
  if (status === 408 || status === 429 || (status !== null && status >= 500)) {
    return new AiProviderError(message, "RETRYABLE", status);
  }
  if (status !== null && status >= 400) {
    return new AiProviderError(message, hasSafetySignal(error) ? "SAFETY" : "CONFIG", status);
  }
  return new AiProviderError(message, "RETRYABLE", status);
}
