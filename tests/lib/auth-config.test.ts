import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { isTokenOlderThanAccount, readTokenIssuedAt, timeBucket } from "@/lib/auth-config";

function tokenIssuedAt(seconds: number) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const body = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ email: "a@contoh.test", iat: seconds })}`;
  return `${body}.${createHmac("sha256", "rahasia-uji").update(body).digest("base64url")}`;
}

describe("timeBucket", () => {
  it("changes only after the window has passed", () => {
    const start = new Date("2026-10-09T10:00:05Z");
    expect(timeBucket(new Date(start.getTime() + 10_000), 60)).toBe(timeBucket(start, 60));
    expect(timeBucket(new Date(start.getTime() + 60_000), 60)).not.toBe(timeBucket(start, 60));
  });
});

describe("verification token age", () => {
  const created = new Date("2026-10-09T10:00:00.500Z");
  const createdSeconds = Math.floor(created.getTime() / 1000);

  it("reads the issued-at claim", () => {
    expect(readTokenIssuedAt(tokenIssuedAt(createdSeconds))).toBe(createdSeconds);
    expect(readTokenIssuedAt("bukan-jwt")).toBeNull();
    expect(readTokenIssuedAt("a.%%%.c")).toBeNull();
  });

  it("accepts tokens issued with or after the account and rejects older ones", () => {
    expect(isTokenOlderThanAccount(tokenIssuedAt(createdSeconds), created)).toBe(false);
    expect(isTokenOlderThanAccount(tokenIssuedAt(createdSeconds + 30), created)).toBe(false);
    expect(isTokenOlderThanAccount(tokenIssuedAt(createdSeconds - 1), created)).toBe(true);
  });

  it("rejects tokens without a usable claim", () => {
    expect(isTokenOlderThanAccount("bukan-jwt", created)).toBe(true);
  });
});
