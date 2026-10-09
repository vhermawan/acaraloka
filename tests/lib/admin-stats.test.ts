import { describe, expect, it } from "vitest";

import {
  bucketStart,
  dayBucketKeys,
  fillSeries,
  formatDayLabel,
  formatWeekLabel,
  jakartaDayKey,
  jakartaWeekKey,
  seriesTotal,
  usagePercent,
  weekBucketKeys,
} from "@/lib/admin-stats";

describe("jakartaDayKey", () => {
  it("rolls over at midnight WIB, not UTC", () => {
    expect(jakartaDayKey(new Date("2026-03-10T16:59:59.999Z"))).toBe("2026-03-10");
    expect(jakartaDayKey(new Date("2026-03-10T17:00:00.000Z"))).toBe("2026-03-11");
  });

  it("crosses month and year boundaries", () => {
    expect(jakartaDayKey(new Date("2026-12-31T17:00:00Z"))).toBe("2027-01-01");
    expect(jakartaDayKey(new Date("2028-02-28T17:00:00Z"))).toBe("2028-02-29");
  });
});

describe("jakartaWeekKey", () => {
  it("starts weeks on Monday", () => {
    expect(jakartaWeekKey(new Date("2026-10-05T00:00:00Z"))).toBe("2026-10-05");
    expect(jakartaWeekKey(new Date("2026-10-11T12:00:00Z"))).toBe("2026-10-05");
    expect(jakartaWeekKey(new Date("2026-10-11T17:00:00Z"))).toBe("2026-10-12");
  });

  it("handles weeks spanning a year boundary", () => {
    expect(jakartaWeekKey(new Date("2027-01-01T05:00:00Z"))).toBe("2026-12-28");
  });
});

describe("bucket keys", () => {
  it("lists consecutive days ending today in WIB", () => {
    const keys = dayBucketKeys(new Date("2026-03-02T18:00:00Z"), 5);
    expect(keys).toEqual(["2026-02-27", "2026-02-28", "2026-03-01", "2026-03-02", "2026-03-03"]);
  });

  it("returns the requested number of days", () => {
    expect(dayBucketKeys(new Date("2026-10-09T03:00:00Z"))).toHaveLength(30);
    expect(dayBucketKeys(new Date("2026-10-09T03:00:00Z")).at(-1)).toBe("2026-10-09");
  });

  it("lists Monday-based weeks ending this week", () => {
    expect(weekBucketKeys(new Date("2027-01-06T00:00:00Z"), 3)).toEqual(["2026-12-21", "2026-12-28", "2027-01-04"]);
    expect(weekBucketKeys(new Date("2026-10-09T00:00:00Z"))).toHaveLength(12);
  });

  it("converts a key to the UTC instant of local midnight", () => {
    expect(bucketStart("2026-03-11").toISOString()).toBe("2026-03-10T17:00:00.000Z");
  });
});

describe("fillSeries", () => {
  it("fills empty buckets with zero and keeps order", () => {
    const series = fillSeries(["2026-03-01", "2026-03-02", "2026-03-03"], [{ bucket: "2026-03-03", count: BigInt(4) }]);
    expect(series).toEqual([
      { key: "2026-03-01", count: 0 },
      { key: "2026-03-02", count: 0 },
      { key: "2026-03-03", count: 4 },
    ]);
  });

  it("ignores rows outside the window and sums duplicates", () => {
    const series = fillSeries(
      ["2026-03-01"],
      [
        { bucket: "2026-03-01", count: 1 },
        { bucket: "2026-03-01", count: 2 },
        { bucket: "2020-01-01", count: 9 },
      ],
    );
    expect(series).toEqual([{ key: "2026-03-01", count: 3 }]);
    expect(seriesTotal(series)).toBe(3);
  });
});

describe("labels and usage", () => {
  it("formats Indonesian day and week labels", () => {
    expect(formatDayLabel("2026-05-09")).toBe("9 Mei");
    expect(formatWeekLabel("2026-12-28")).toBe("28 Des – 3 Jan");
  });

  it("clamps usage percent", () => {
    expect(usagePercent(250, 500)).toBe(50);
    expect(usagePercent(600, 500)).toBe(100);
    expect(usagePercent(1, 0)).toBe(0);
  });
});
