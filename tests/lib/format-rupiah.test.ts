import { describe, expect, it } from "vitest";

import { formatRupiah } from "@/lib/format";

describe("formatRupiah", () => {
  it.each([
    [0, "Rp0"],
    [500, "Rp500"],
    [50000, "Rp50.000"],
    [100000000, "Rp100.000.000"],
  ])("%d -> %s", (amount, expected) => {
    expect(formatRupiah(amount)).toBe(expected);
  });
});
