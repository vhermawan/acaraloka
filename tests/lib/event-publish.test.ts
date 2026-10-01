import { describe, expect, it } from "vitest";

import { getPublishIssues, isPubliclyVisible } from "@/lib/event-publish";

const now = new Date("2026-10-01T00:00:00Z");
const ready = {
  status: "DRAFT",
  startAt: new Date("2026-11-01T02:00:00Z"),
  endAt: new Date("2026-11-01T05:00:00Z"),
  ticketTypeCount: 1,
};

describe("getPublishIssues", () => {
  it("passes a complete draft", () => {
    expect(getPublishIssues(ready, now)).toEqual([]);
  });

  it("requires at least one ticket type", () => {
    expect(getPublishIssues({ ...ready, ticketTypeCount: 0 }, now)).toHaveLength(1);
  });

  it("rejects past start and inverted times", () => {
    expect(getPublishIssues({ ...ready, startAt: new Date("2026-09-30T00:00:00Z") }, now)).toContain(
      "Waktu mulai harus di masa depan.",
    );
    expect(getPublishIssues({ ...ready, endAt: ready.startAt }, now)).toContain(
      "Waktu selesai harus setelah waktu mulai.",
    );
  });

  it("rejects non-draft events", () => {
    expect(getPublishIssues({ ...ready, status: "PUBLISHED" }, now)).toContain("Hanya acara draf yang bisa diterbitkan.");
  });
});

describe("isPubliclyVisible", () => {
  it.each([
    ["PUBLISHED", true],
    ["CANCELLED", true],
    ["DRAFT", false],
    ["DISABLED", false],
  ])("%s -> %s", (status, expected) => {
    expect(isPubliclyVisible(status)).toBe(expected);
  });
});
