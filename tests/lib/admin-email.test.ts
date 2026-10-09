import { describe, expect, it } from "vitest";

import {
  maskEmail,
  parseEmailStatusFilter,
  parseEmailTemplateFilter,
  redactEmailError,
  remainingBudget,
} from "@/lib/admin-email";

describe("maskEmail", () => {
  it.each([
    ["vihermawan@gmail.com", "vi***@gmail.com"],
    ["VIHERMAWAN@Gmail.COM", "vi***@gmail.com"],
    ["abcd@x.id", "ab***@x.id"],
    ["abc@x.id", "a***@x.id"],
    ["ab@x.id", "a***@x.id"],
    ["a@x.id", "***@x.id"],
    ["  budi@x.id \n", "bu***@x.id"],
    ["a@b@c.com", "a***@c.com"],
    ["no-at-sign", "***"],
    ["", "***"],
    ["@x.id", "***"],
    ["budi@", "***"],
    ["@", "***"],
    ["Nama Lengkap <vihermawan@gmail.com>", "vi***@gmail.com"],
    ["<budi@x.id>", "bu***@x.id"],
    ['"budi@x.id"', "bu***@x.id"],
  ])("masks %j as %j", (input, expected) => {
    expect(maskEmail(input)).toBe(expected);
  });

  it("handles null and undefined", () => {
    expect(maskEmail(null)).toBe("***");
    expect(maskEmail(undefined)).toBe("***");
  });

  it("never reveals the full local part", () => {
    for (const local of ["a", "ab", "abc", "abcd", "rahasia.sekali"]) {
      const masked = maskEmail(`${local}@x.id`);
      expect(masked).not.toContain(local.length > 2 ? local : "\u0000");
      expect(masked).toContain("***@x.id");
    }
  });

  it("truncates absurdly long domains", () => {
    expect(maskEmail(`budi@${"a".repeat(200)}.com`).length).toBeLessThan(80);
  });
});

describe("redactEmailError", () => {
  it("returns null for empty values", () => {
    expect(redactEmailError(null)).toBeNull();
    expect(redactEmailError("")).toBeNull();
    expect(redactEmailError("   \n ")).toBeNull();
  });

  it("keeps plain messages", () => {
    expect(redactEmailError("422: Invalid recipient")).toBe("422: Invalid recipient");
  });

  it("replaces urls including tokens in query strings", () => {
    const out = redactEmailError("500: failed https://acaraloka.id/verify?token=abc123def456 now");
    expect(out).toBe("500: failed [url] now");
  });

  it("replaces email addresses", () => {
    expect(redactEmailError("rejected budi@gmail.com")).toBe("rejected [email]");
  });

  it("replaces long opaque tokens and api keys", () => {
    const out = redactEmailError("auth failed re_AbCdEfGhIjKlMnOpQrStUvWxYz123456 end");
    expect(out).toBe("auth failed [token] end");
  });

  it("replaces key=value secrets and bearer values", () => {
    expect(redactEmailError("token=xyz")).toBe("token=[redacted]");
    expect(redactEmailError("Authorization: Bearer abc")).toBe("Authorization=[redacted]");
    expect(redactEmailError("Authorization: Basic abc123")).toBe("Authorization=[redacted]");
    expect(redactEmailError("failed Basic dXNlcjpwYXNz here")).toBe("failed Basic [redacted] here");
    expect(redactEmailError("sent token abcdefghij12 ok")).toBe("sent token [redacted] ok");
    expect(redactEmailError("token expired")).toBe("token expired");
    expect(redactEmailError("bearer abc")).toBe("bearer [redacted]");
  });

  it.each([
    ["api_key=abc", "abc"],
    ["access_token=zzz111", "zzz111"],
    ["client_secret: s3cr3t", "s3cr3t"],
    ["apiKey: xyz", "xyz"],
    ["x-api-key: short", "short"],
    ['{"password":"hunter2"}', "hunter2"],
    ["db_password = hunter2", "hunter2"],
  ])("redacts compound secret names in %j", (input, secret) => {
    const out = redactEmailError(input)!;
    expect(out).not.toContain(secret);
    expect(out).toContain("[redacted]");
  });

  it("collapses whitespace and truncates", () => {
    const out = redactEmailError(`a\n\nb ${"word ".repeat(100)}`)!;
    expect(out.startsWith("a b word")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(201);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("filter parsers", () => {
  it("accepts only known statuses", () => {
    expect(parseEmailStatusFilter("FAILED")).toBe("FAILED");
    expect(parseEmailStatusFilter(["SENT", "FAILED"])).toBe("SENT");
    expect(parseEmailStatusFilter("failed")).toBeNull();
    expect(parseEmailStatusFilter("x'; DROP")).toBeNull();
    expect(parseEmailStatusFilter(undefined)).toBeNull();
  });

  it("accepts only known templates", () => {
    expect(parseEmailTemplateFilter("verify-email")).toBe("verify-email");
    expect(parseEmailTemplateFilter("nope")).toBeNull();
    expect(parseEmailTemplateFilter(undefined)).toBeNull();
  });
});

describe("remainingBudget", () => {
  it("never goes below zero", () => {
    expect(remainingBudget(95, 10)).toBe(85);
    expect(remainingBudget(95, 95)).toBe(0);
    expect(remainingBudget(95, 120)).toBe(0);
  });
});
