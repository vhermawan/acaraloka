import { describe, expect, it } from "vitest";

import { claimLimit, classifySendFailure, redactEmails, retryDelayMs } from "@/lib/email-outbox";

describe("classifySendFailure", () => {
  it("separates rate limits, transient errors and rejections", () => {
    expect(classifySendFailure(429)).toBe("RATE_LIMITED");
    expect(classifySendFailure(null)).toBe("RETRY");
    expect(classifySendFailure(500)).toBe("RETRY");
    expect(classifySendFailure(503)).toBe("RETRY");
    expect(classifySendFailure(409)).toBe("RETRY");
    expect(classifySendFailure(422)).toBe("REJECTED");
    expect(classifySendFailure(403)).toBe("REJECTED");
  });
});

describe("retryDelayMs", () => {
  it("doubles from five minutes and caps at six hours", () => {
    expect(retryDelayMs(1)).toBe(5 * 60_000);
    expect(retryDelayMs(2)).toBe(10 * 60_000);
    expect(retryDelayMs(3)).toBe(20 * 60_000);
    expect(retryDelayMs(20)).toBe(6 * 60 * 60_000);
  });
});

describe("claimLimit", () => {
  it("never exceeds the remaining budget or the per-drain cap", () => {
    expect(claimLimit(95, 0)).toBe(95);
    expect(claimLimit(95, 90)).toBe(5);
    expect(claimLimit(95, 120)).toBe(0);
    expect(claimLimit(95, 0, 10)).toBe(10);
  });
});

describe("redactEmails", () => {
  it("hides addresses in provider error messages", () => {
    expect(redactEmails("Invalid `to` field: budi@contoh.test is not allowed")).toBe(
      "Invalid `to` field: [email] is not allowed",
    );
  });
});
