export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;
export const VERIFICATION_TTL_SECONDS = 24 * 60 * 60;
export const RESET_TTL_SECONDS = 60 * 60;
export const AUTH_EMAIL_BUCKET_SECONDS = 60;
export const ACCOUNT_NOTICE_BUCKET_SECONDS = 60 * 60;
export const RESEND_COOLDOWN_SECONDS = 60;
export const AUTH_EMAILS_PER_ADDRESS_PER_HOUR = 5;

export const AUTH_RATE_LIMITS = {
  "/sign-in/email": { window: 60, max: 10 },
  "/sign-up/email": { window: 60 * 60, max: 10 },
  "/request-password-reset": { window: 60 * 60, max: 5 },
  "/send-verification-email": { window: 60 * 60, max: 6 },
  "/reset-password": { window: 60 * 60, max: 10 },
} as const;

export function timeBucket(now: Date, seconds: number) {
  return Math.floor(now.getTime() / (seconds * 1000));
}

export function readTokenIssuedAt(token: string): number | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { iat?: unknown };
    return typeof decoded.iat === "number" ? decoded.iat : null;
  } catch {
    return null;
  }
}

export function isTokenOlderThanAccount(token: string, accountCreatedAt: Date): boolean {
  const issuedAt = readTokenIssuedAt(token);
  if (issuedAt === null) return true;
  return issuedAt < Math.floor(accountCreatedAt.getTime() / 1000);
}
