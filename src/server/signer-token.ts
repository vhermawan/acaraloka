import "server-only";

import { createHash, randomBytes } from "node:crypto";

export function generateSignerToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSignerToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
