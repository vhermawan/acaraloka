import { describe, expect, it } from "vitest";

import {
  addDays,
  addMonthsToKey,
  formatDateKey,
  formatMonthView,
  localDateKey,
  monthGrid,
  shiftView,
  splitLocalDateTime,
  timeSlots,
  weekdayIndex,
} from "@/lib/calendar";

describe("calendar helpers", () => {
  it("splits a datetime-local value", () => {
    expect(splitLocalDateTime("2026-10-12T09:00")).toEqual({ date: "2026-10-12", time: "09:00" });
    expect(splitLocalDateTime("")).toBeNull();
    expect(splitLocalDateTime("2026-10-12")).toBeNull();
  });

  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
  });

  it("clamps the day when moving months", () => {
    expect(addMonthsToKey("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsToKey("2026-12-15", 1)).toBe("2027-01-15");
  });

  it("starts weeks on Monday", () => {
    expect(weekdayIndex("2026-10-12")).toBe(0);
    expect(weekdayIndex("2026-10-18")).toBe(6);
  });

  it("builds a six-week grid padded with neighbouring days", () => {
    const grid = monthGrid({ year: 2026, month: 9 });
    expect(grid).toHaveLength(6);
    expect(grid[0][0]).toEqual({ key: "2026-09-28", inMonth: false });
    expect(grid[0][3]).toEqual({ key: "2026-10-01", inMonth: true });
    expect(grid[5][6]).toEqual({ key: "2026-11-08", inMonth: false });
  });

  it("shifts month views across years", () => {
    expect(shiftView({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftView({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
  });

  it("reads today in the event timezone", () => {
    const instant = new Date("2026-10-11T18:00:00Z");
    expect(localDateKey(instant, "Asia/Jakarta")).toBe("2026-10-12");
    expect(localDateKey(instant, "UTC")).toBe("2026-10-11");
  });

  it("lists half-hour slots for a whole day", () => {
    const slots = timeSlots(30);
    expect(slots).toHaveLength(48);
    expect(slots[0]).toBe("00:00");
    expect(slots[19]).toBe("09:30");
  });

  it("formats Indonesian labels", () => {
    expect(formatMonthView({ year: 2026, month: 9 })).toBe("Oktober 2026");
    expect(formatDateKey("2026-10-12", { weekday: "long", day: "numeric", month: "long", year: "numeric" })).toBe(
      "Senin, 12 Oktober 2026",
    );
  });
});
