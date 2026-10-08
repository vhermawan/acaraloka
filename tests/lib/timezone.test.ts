import { describe, expect, it } from "vitest";

import { formatEventSchedule } from "@/lib/timezone";

describe("formatEventSchedule", () => {
  it("formats weekday, date, time and zone label in the event timezone", () => {
    expect(formatEventSchedule(new Date("2026-10-12T02:00:00Z"), "Asia/Jakarta")).toBe("Sen, 12 Okt 2026 · 09.00 WIB");
  });

  it("shifts the calendar day for eastern zones", () => {
    expect(formatEventSchedule(new Date("2026-10-11T16:30:00Z"), "Asia/Jayapura")).toBe("Sen, 12 Okt 2026 · 01.30 WIT");
  });
});
