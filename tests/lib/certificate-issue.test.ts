import { describe, expect, it } from "vitest";

import { issueBlocker } from "@/lib/certificate-issue";

const now = new Date("2026-11-01T00:00:00Z");
const ready = {
  eventStatus: "PUBLISHED",
  startAt: new Date("2026-10-31T00:00:00Z"),
  lockedAt: new Date("2026-10-30T00:00:00Z"),
  signerStatuses: ["SIGNED", "SIGNED"],
};

describe("issueBlocker", () => {
  it.each([
    ["ready", {}, null],
    ["cancelled", { eventStatus: "CANCELLED" }, "CLOSED"],
    ["disabled", { eventStatus: "DISABLED" }, "CLOSED"],
    ["not started", { startAt: new Date("2026-11-02T00:00:00Z") }, "NOT_STARTED"],
    ["no signers", { signerStatuses: [] }, "NO_SIGNERS"],
    ["pending signer", { signerStatuses: ["SIGNED", "PENDING"] }, "NOT_SIGNED"],
    ["declined signer", { signerStatuses: ["DECLINED"] }, "NOT_SIGNED"],
    ["not locked", { lockedAt: null }, "NOT_LOCKED"],
  ] as const)("%s", (_label, override, expected) => {
    expect(issueBlocker({ ...ready, ...override }, now)).toBe(expected);
  });
});
