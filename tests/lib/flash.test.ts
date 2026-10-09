import { describe, expect, it } from "vitest";

import { flashMessage } from "@/lib/flash";

describe("flash messages", () => {
  it("returns the message for a known key", () => {
    expect(flashMessage("event-created")).toContain("Acara berhasil dibuat");
  });

  it("ignores unknown or inherited keys", () => {
    expect(flashMessage("nope")).toBeNull();
    expect(flashMessage("toString")).toBeNull();
    expect(flashMessage(undefined)).toBeNull();
  });
});
