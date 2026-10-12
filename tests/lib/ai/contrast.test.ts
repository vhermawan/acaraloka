import { describe, expect, it } from "vitest";

import { DARK_TEXT, LIGHT_TEXT, contrastRatio, hexToRgb, resolveReadableText } from "@/lib/ai/contrast";

const NAVY = { r: 12, g: 18, b: 40 };
const IVORY = { r: 251, g: 249, b: 243 };

describe("contrast", () => {
  it("computes the WCAG ratio for black on white", () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 5);
  });

  it("keeps a readable color unchanged", () => {
    const result = resolveReadableText("#1c1c1f", IVORY);
    expect(result).toMatchObject({ color: "#1c1c1f", adjusted: false });
    expect(result.ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("switches dark text on a dark background to light text", () => {
    const result = resolveReadableText("#1c1c1f", NAVY);
    expect(result).toMatchObject({ color: LIGHT_TEXT, adjusted: true });
    expect(result.ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("switches light text on a light background to dark text", () => {
    expect(resolveReadableText("#ffffff", IVORY)).toMatchObject({ color: DARK_TEXT, adjusted: true });
  });

  it("picks the better candidate on a mid-tone background", () => {
    const mid = hexToRgb("#808080");
    const result = resolveReadableText("#888888", mid);
    expect(result.adjusted).toBe(true);
    expect(result.ratio).toBe(Math.max(contrastRatio(hexToRgb(DARK_TEXT), mid), contrastRatio(hexToRgb(LIGHT_TEXT), mid)));
  });
});
