import { describe, expect, it } from "vitest";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";

describe("isAuthorizedCronRequest", () => {
  it("accepts the exact bearer secret", () => {
    expect(isAuthorizedCronRequest("Bearer s3cret", "s3cret")).toBe(true);
  });

  it.each([
    [null, "s3cret"],
    ["Bearer wrong", "s3cret"],
    ["s3cret", "s3cret"],
    ["Bearer s3cret", undefined],
    ["Bearer ", ""],
  ])("rejects %j with secret %j", (header, secret) => {
    expect(isAuthorizedCronRequest(header, secret)).toBe(false);
  });
});
