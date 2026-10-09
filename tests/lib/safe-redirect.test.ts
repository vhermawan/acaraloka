import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "@/lib/safe-redirect";

describe("safeRedirectPath", () => {
  it.each([
    ["/me/tickets", "/me/tickets"],
    ["/organizer?tab=1", "/organizer?tab=1"],
    ["//evil.example", "/"],
    ["/\\evil.example", "/"],
    ["https://evil.example", "/"],
    ["/\t/evil.example", "/"],
    ["/\n/evil.example", "/"],
    ["/me\u0000", "/"],
    ["", "/"],
    [undefined, "/"],
    [["/a"], "/"],
  ])("%j -> %s", (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });
});
