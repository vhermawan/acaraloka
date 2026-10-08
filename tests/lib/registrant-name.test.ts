import { describe, expect, it } from "vitest";

import { registrantNameSchema } from "@/lib/validation/registration";

describe("registrantNameSchema", () => {
  it("trims and accepts a normal name", () => {
    expect(registrantNameSchema.parse("  Budi Santoso  ")).toBe("Budi Santoso");
  });

  it("rejects too short and too long names", () => {
    expect(registrantNameSchema.safeParse("B").success).toBe(false);
    expect(registrantNameSchema.safeParse(" ".repeat(5)).success).toBe(false);
    expect(registrantNameSchema.safeParse("a".repeat(101)).success).toBe(false);
  });

  it("rejects control characters", () => {
    expect(registrantNameSchema.safeParse("Budi\u0000 Santoso").success).toBe(false);
    expect(registrantNameSchema.safeParse("Budi\nSantoso").success).toBe(false);
  });
});
