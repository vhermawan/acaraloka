import { describe, expect, it } from "vitest";

import { splitEventsByStart } from "@/lib/event-groups";

const now = new Date("2026-10-08T12:00:00Z");
const event = (id: string, iso: string) => ({ id, startAt: new Date(iso) });

describe("splitEventsByStart", () => {
  it("puts upcoming events soonest first and past events latest first", () => {
    const { upcoming, past } = splitEventsByStart(
      [
        event("far", "2026-12-01T00:00:00Z"),
        event("old", "2026-01-01T00:00:00Z"),
        event("soon", "2026-10-09T00:00:00Z"),
        event("recent", "2026-10-01T00:00:00Z"),
      ],
      now,
    );
    expect(upcoming.map((item) => item.id)).toEqual(["soon", "far"]);
    expect(past.map((item) => item.id)).toEqual(["recent", "old"]);
  });

  it("treats an event starting exactly now as upcoming", () => {
    const { upcoming, past } = splitEventsByStart([event("now", now.toISOString())], now);
    expect(upcoming).toHaveLength(1);
    expect(past).toHaveLength(0);
  });
});
