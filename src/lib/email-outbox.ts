import type { EmailMessage } from "@/lib/email-templates";

export const EMAIL_PRIORITY = { AUTH: 0, TRANSACTIONAL: 1, BULK: 2 } as const;

export type OutboxItem = EmailMessage & { to: string; dedupeKey: string; priority: number };

export const MAX_EMAIL_ATTEMPTS = 5;
export const MAX_EMAILS_PER_DRAIN = 100;
export const BUDGET_WINDOW_MS = 24 * 60 * 60 * 1000;
export const STALE_CLAIM_MS = 15 * 60 * 1000;
export const OUTBOX_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

const RETRY_BASE_MS = 5 * 60 * 1000;
const RETRY_MAX_MS = 6 * 60 * 60 * 1000;

export type SendFailureKind = "RATE_LIMITED" | "RETRY" | "REJECTED";

export function classifySendFailure(status: number | null): SendFailureKind {
  if (status === 429) return "RATE_LIMITED";
  if (status === null || status >= 500 || status === 408 || status === 409) return "RETRY";
  return "REJECTED";
}

export function retryDelayMs(attempts: number): number {
  return Math.min(RETRY_BASE_MS * 2 ** Math.max(0, attempts - 1), RETRY_MAX_MS);
}

export function claimLimit(budget: number, used: number, max = MAX_EMAILS_PER_DRAIN): number {
  return Math.max(0, Math.min(budget - used, max));
}

export function redactEmails(text: string): string {
  return text.replace(/[^\s@<>"'`]+@[^\s@<>"'`]+/g, "[email]");
}
