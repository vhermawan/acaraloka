import { describe, expect, it } from "vitest";

import { CERTIFICATE_NUMBER_PREFIX } from "@/lib/brand";
import {
  CERTIFICATE_SUFFIX_ALPHABET,
  buildCertificateNumber,
  certificateSuffix,
  certificateYearMonth,
} from "@/lib/certificate-number";

describe("certificate number", () => {
  it("derives the prefix from the product name", () => {
    expect(CERTIFICATE_NUMBER_PREFIX).toBe("HA");
  });

  it("uses the Jakarta calendar for year and month", () => {
    expect(certificateYearMonth(new Date("2026-10-15T00:00:00Z"))).toBe("2610");
    expect(certificateYearMonth(new Date("2026-10-31T17:30:00Z"))).toBe("2611");
    expect(certificateYearMonth(new Date("2026-12-31T16:59:00Z"))).toBe("2612");
    expect(certificateYearMonth(new Date("2026-12-31T17:00:00Z"))).toBe("2701");
  });

  it("builds prefix, year-month, padded sequence, and suffix", () => {
    expect(buildCertificateNumber({ date: new Date("2026-10-15T00:00:00Z"), seq: 42, suffix: "K7Q3XM" })).toBe(
      "HA-2610-0042-K7Q3XM",
    );
    expect(buildCertificateNumber({ date: new Date("2026-10-15T00:00:00Z"), seq: 12345, suffix: "AAAAAA" })).toBe(
      "HA-2610-12345-AAAAAA",
    );
  });

  it("generates suffixes without ambiguous characters", () => {
    expect(CERTIFICATE_SUFFIX_ALPHABET).not.toMatch(/[ILOU01]/);
    for (let index = 0; index < 200; index += 1) {
      expect(certificateSuffix()).toMatch(new RegExp(`^[${CERTIFICATE_SUFFIX_ALPHABET}]{6}$`));
    }
    expect(new Set(Array.from({ length: 50 }, certificateSuffix)).size).toBeGreaterThan(40);
  });
});
