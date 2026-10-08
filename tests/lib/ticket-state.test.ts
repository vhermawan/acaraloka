import { describe, expect, it } from "vitest";

import { ticketState } from "@/lib/ticket-state";

const now = new Date("2026-11-01T00:00:00Z");
const future = { status: "PUBLISHED", endAt: new Date("2026-11-02T00:00:00Z") };
const active = { status: "CONFIRMED", checkedInAt: null };

describe("ticketState", () => {
  it.each([
    ["active", active, future, "ACTIVE"],
    ["checked in", { ...active, checkedInAt: now }, future, "CHECKED_IN"],
    ["cancelled registration", { ...active, status: "CANCELLED" }, future, "CANCELLED"],
    ["cancelled event wins", { ...active, checkedInAt: now }, { ...future, status: "CANCELLED" }, "EVENT_CANCELLED"],
    ["disabled event wins", { ...active, checkedInAt: now }, { ...future, status: "DISABLED" }, "EVENT_DISABLED"],
    ["ended", active, { ...future, endAt: new Date("2026-10-31T00:00:00Z") }, "ENDED"],
  ] as const)("%s", (_label, registration, event, expected) => {
    expect(ticketState(registration, event, now)).toBe(expected);
  });
});
