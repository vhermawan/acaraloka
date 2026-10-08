import { describe, expect, it } from "vitest";

import { statusBeforeDisable } from "@/lib/event-disable";
import { disableReasonSchema } from "@/lib/validation/event-disable";

const date = new Date("2026-11-01T00:00:00Z");

describe("statusBeforeDisable", () => {
  it.each([
    ["never published", { cancelledAt: null, publishedAt: null }, "DRAFT"],
    ["published", { cancelledAt: null, publishedAt: date }, "PUBLISHED"],
    ["cancelled after publish", { cancelledAt: date, publishedAt: date }, "CANCELLED"],
  ] as const)("%s", (_label, event, expected) => {
    expect(statusBeforeDisable(event)).toBe(expected);
  });
});

describe("disableReasonSchema", () => {
  it("trims and accepts a reasonable reason", () => {
    expect(disableReasonSchema.parse("  Melanggar aturan  ")).toBe("Melanggar aturan");
  });

  it.each(["", "   ", "abc", "x".repeat(501)])("rejects %j", (value) => {
    expect(disableReasonSchema.safeParse(value).success).toBe(false);
  });
});
