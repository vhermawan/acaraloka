import { describe, expect, it } from "vitest";

import { AI_PRICING, imageCostMicros, textCostMicros } from "@/lib/ai-config";

describe("token cost", () => {
  it("prices image tokens from usage metadata", () => {
    const micros = imageCostMicros({ promptTokens: 400, outputTokens: 1700, thoughtTokens: 0, imageOutputTokens: 1680 });
    expect(micros).toBe(Math.round((400 * 500_000) / 1e6) + Math.round((1680 * 30_000_000) / 1e6));
    expect(micros).toBeGreaterThan(50_000);
    expect(micros).toBeLessThan(51_000);
  });

  it("falls back to the flat image price when no image tokens are reported", () => {
    expect(imageCostMicros({ promptTokens: 0, outputTokens: 0, thoughtTokens: 0, imageOutputTokens: 0 })).toBe(
      AI_PRICING.imageMicros,
    );
  });

  it("prices text input, output and thinking tokens", () => {
    expect(textCostMicros({ promptTokens: 1000, outputTokens: 500, thoughtTokens: 500, imageOutputTokens: 0 })).toBe(
      Math.round((1000 * 250_000) / 1e6) + Math.round((1000 * 1_500_000) / 1e6),
    );
  });
});
