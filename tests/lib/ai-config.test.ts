import { describe, expect, it } from "vitest";

import {
  AI_PRICING,
  activeCapUsd,
  estimateGenerationMicros,
  usdToMicros,
  wibDateString,
  wibDayStart,
  wibMonthStart,
} from "@/lib/ai-config";

const caps = { monthlyCapUsd: 10, trialCapUsd: 30 };

describe("WIB boundaries", () => {
  it("starts the WIB day at 17:00 UTC of the previous day", () => {
    expect(wibDayStart(new Date("2026-10-12T10:00:00Z")).toISOString()).toBe("2026-10-11T17:00:00.000Z");
    expect(wibDayStart(new Date("2026-10-12T17:00:00Z")).toISOString()).toBe("2026-10-12T17:00:00.000Z");
    expect(wibDayStart(new Date("2026-10-12T16:59:59Z")).toISOString()).toBe("2026-10-11T17:00:00.000Z");
  });

  it("starts the WIB month at the first of the month in WIB", () => {
    expect(wibMonthStart(new Date("2026-10-15T00:00:00Z")).toISOString()).toBe("2026-09-30T17:00:00.000Z");
    expect(wibMonthStart(new Date("2026-09-30T17:00:00Z")).toISOString()).toBe("2026-09-30T17:00:00.000Z");
    expect(wibMonthStart(new Date("2026-09-30T16:59:59Z")).toISOString()).toBe("2026-08-31T17:00:00.000Z");
  });

  it("rolls the year over in WIB", () => {
    expect(wibMonthStart(new Date("2026-12-31T18:00:00Z")).toISOString()).toBe("2026-12-31T17:00:00.000Z");
    expect(wibDateString(new Date("2026-12-31T18:00:00Z"))).toBe("2027-01-01");
  });
});

describe("activeCapUsd", () => {
  it("uses the trial cap while the WIB date is before the end date", () => {
    expect(activeCapUsd(new Date("2027-01-30T16:00:00Z"), { ...caps, trialEndsOn: "2027-01-31" })).toBe(30);
  });

  it("drops to the normal cap on the end date", () => {
    expect(activeCapUsd(new Date("2027-01-30T17:00:00Z"), { ...caps, trialEndsOn: "2027-01-31" })).toBe(10);
  });

  it("uses the normal cap when no end date is configured", () => {
    expect(activeCapUsd(new Date("2026-10-12T00:00:00Z"), { ...caps, trialEndsOn: null })).toBe(10);
  });
});

describe("cost helpers", () => {
  it("estimates the worst case from the pricing table", () => {
    expect(estimateGenerationMicros()).toBe(AI_PRICING.imageMicros * AI_PRICING.maxImageAttempts + AI_PRICING.briefMicros);
    expect(estimateGenerationMicros({ imageMicros: 10, briefMicros: 1, maxImageAttempts: 3 })).toBe(31);
  });

  it("converts USD to integer micro-USD", () => {
    expect(usdToMicros(10)).toBe(10_000_000);
    expect(usdToMicros(0.055)).toBe(55_000);
  });
});
