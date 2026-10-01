import { describe, expect, it } from "vitest";
import { buildErrorFingerprint, normalizeErrorMessage } from "@/lib/error-fingerprint";

describe("normalizeErrorMessage", () => {
  it("replaces variable parts", () => {
    expect(normalizeErrorMessage("Event clx1a2b3c4d5e6f7g8h9i0j1k2 not found after 1500 ms")).toBe(
      "Event <id> not found after <n> ms",
    );
    expect(normalizeErrorMessage("row 3f2a1b9c-1234-4abc-9def-0123456789ab missing")).toBe("row <uuid> missing");
  });
});

describe("buildErrorFingerprint", () => {
  const base = {
    source: "render:/admin/test-error",
    name: "Error",
    message: "Admin test error 1727740000000",
    stack: "Error: Admin test error\n    at AdminTestErrorPage (src/app/admin/test-error/page.tsx:5:9)",
  };

  it("groups errors differing only in numbers or line positions", () => {
    const other = {
      ...base,
      message: "Admin test error 1727749999999",
      stack: "Error: Admin test error\n    at AdminTestErrorPage (src/app/admin/test-error/page.tsx:6:3)",
    };
    expect(buildErrorFingerprint(other)).toBe(buildErrorFingerprint(base));
  });

  it("separates different sources and messages", () => {
    expect(buildErrorFingerprint({ ...base, source: "route:/api/x" })).not.toBe(buildErrorFingerprint(base));
    expect(buildErrorFingerprint({ ...base, message: "Other failure" })).not.toBe(buildErrorFingerprint(base));
  });
});
