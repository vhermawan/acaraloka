import { describe, expect, it } from "vitest";

import { isCheckInOpen, isDuplicateScan, normalizeTicketCode } from "@/lib/checkin";
import { generateTicketCode } from "@/lib/ticket-code";

describe("normalizeTicketCode", () => {
  it("accepts generated ticket codes", () => {
    const code = generateTicketCode();
    expect(normalizeTicketCode(code)).toBe(code);
    expect(normalizeTicketCode(`  ${code.toUpperCase()}\n`)).toBe(code);
  });

  it.each(["", "abc", "https://example.com/e/slug", "a".repeat(27), "0".repeat(26), "a1".repeat(13)])(
    "rejects %j",
    (raw) => {
      expect(normalizeTicketCode(raw)).toBeNull();
    },
  );
});

describe("isDuplicateScan", () => {
  it("ignores the same code inside the window", () => {
    expect(isDuplicateScan({ code: "x", at: 1000 }, "x", 3999)).toBe(true);
    expect(isDuplicateScan({ code: "x", at: 1000 }, "x", 4000)).toBe(false);
    expect(isDuplicateScan({ code: "x", at: 1000 }, "y", 1500)).toBe(false);
    expect(isDuplicateScan(null, "x", 1500)).toBe(false);
  });
});

describe("isCheckInOpen", () => {
  it("only allows published events", () => {
    expect(isCheckInOpen("PUBLISHED")).toBe(true);
    expect(isCheckInOpen("DRAFT")).toBe(false);
    expect(isCheckInOpen("CANCELLED")).toBe(false);
    expect(isCheckInOpen("DISABLED")).toBe(false);
  });
});
