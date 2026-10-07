import { describe, expect, it } from "vitest";

import { declineReasonSchema, signerLinkState, signerSchema } from "@/lib/validation/signer";

describe("signerSchema", () => {
  it("normalizes email and trims fields", () => {
    expect(signerSchema.parse({ name: " Dr. Budi ", title: "Ketua", email: " Budi@Kampus.AC.ID " })).toEqual({
      name: "Dr. Budi",
      title: "Ketua",
      email: "budi@kampus.ac.id",
    });
  });

  it("rejects invalid input", () => {
    expect(signerSchema.safeParse({ name: "B", title: "Ketua", email: "budi@kampus.ac.id" }).success).toBe(false);
    expect(signerSchema.safeParse({ name: "Budi", title: "Ketua", email: "bukan-email" }).success).toBe(false);
  });
});

describe("declineReasonSchema", () => {
  it("requires a short reason", () => {
    expect(declineReasonSchema.safeParse(" ok ").success).toBe(false);
    expect(declineReasonSchema.safeParse("Jabatan salah").success).toBe(true);
  });
});

describe("signerLinkState", () => {
  const now = new Date("2026-10-07T00:00:00Z");
  const future = new Date("2026-10-08T00:00:00Z");
  const past = new Date("2026-10-06T00:00:00Z");

  it("maps status and expiry", () => {
    expect(signerLinkState({ status: "PENDING", tokenExpiresAt: future }, now)).toBe("ACTIVE");
    expect(signerLinkState({ status: "PENDING", tokenExpiresAt: past }, now)).toBe("EXPIRED");
    expect(signerLinkState({ status: "SIGNED", tokenExpiresAt: past }, now)).toBe("SIGNED");
    expect(signerLinkState({ status: "DECLINED", tokenExpiresAt: future }, now)).toBe("DECLINED");
  });
});
