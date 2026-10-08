import { describe, expect, it } from "vitest";

import { CERTIFICATE_NUMBER_PREFIX } from "@/lib/brand";
import { MAX_CERTIFICATE_NUMBER_LENGTH, normalizeCertificateNumber } from "@/lib/certificate-verify";
import { revokeReasonSchema } from "@/lib/validation/certificate";

describe("normalizeCertificateNumber", () => {
  const number = `${CERTIFICATE_NUMBER_PREFIX}-2601-0001-ABC234`;

  it("trims and uppercases", () => {
    expect(normalizeCertificateNumber(`  ${number.toLowerCase()} `)).toBe(number);
  });

  it("decodes percent-encoding", () => {
    expect(normalizeCertificateNumber(encodeURIComponent(` ${number} `))).toBe(number);
  });

  it("rejects empty, oversized and malformed input", () => {
    expect(normalizeCertificateNumber("   ")).toBeNull();
    expect(normalizeCertificateNumber("A".repeat(MAX_CERTIFICATE_NUMBER_LENGTH + 1))).toBeNull();
    expect(normalizeCertificateNumber("%E0%A4%A")).toBeNull();
  });
});

describe("revokeReasonSchema", () => {
  it("requires a reason of reasonable length", () => {
    expect(revokeReasonSchema.safeParse("   ").success).toBe(false);
    expect(revokeReasonSchema.safeParse("abc").success).toBe(false);
    expect(revokeReasonSchema.safeParse("x".repeat(301)).success).toBe(false);
    expect(revokeReasonSchema.safeParse(" Nama salah ").data).toBe("Nama salah");
  });
});
