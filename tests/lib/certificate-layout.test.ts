import { describe, expect, it } from "vitest";

import {
  certificateLayoutSchema,
  clampCoordinate,
  defaultCertificateLayout,
  parseCertificateLayout,
  signerSlots,
  spreadSigners,
} from "@/lib/certificate-layout";

describe("certificate theme", () => {
  it("fills the default theme for layouts saved before themes existed", () => {
    const source = defaultCertificateLayout(2);
    const legacy: Record<string, unknown> = { ...source };
    delete legacy.theme;
    const parsed = parseCertificateLayout(legacy);
    expect(parsed.theme).toEqual({
      border: "classic",
      accent: "teal",
      fonts: { heading: "times", name: "times", body: "helvetica" },
    });
    expect(parsed).toEqual(source);
  });

  it("fills missing theme fields individually", () => {
    const parsed = certificateLayoutSchema.parse({ ...defaultCertificateLayout(), theme: { accent: "navy", fonts: { name: "prata" } } });
    expect(parsed.theme.accent).toBe("navy");
    expect(parsed.theme.border).toBe("classic");
    expect(parsed.theme.fonts).toEqual({ heading: "times", name: "prata", body: "helvetica" });
  });

  it("rejects unknown theme values", () => {
    const base = defaultCertificateLayout();
    const bad = [
      { border: "fancy" },
      { accent: "pink" },
      { fonts: { heading: "comic-sans" } },
      { fonts: { heading: "great-vibes" } },
      { fonts: { body: "cinzel" } },
    ];
    for (const theme of bad) {
      expect(certificateLayoutSchema.safeParse({ ...base, theme }).success).toBe(false);
    }
  });
});

describe("certificate layout", () => {
  it("produces a valid default for every signer count", () => {
    for (const count of [0, 1, 2, 3]) {
      expect(certificateLayoutSchema.safeParse(defaultCertificateLayout(count)).success).toBe(true);
    }
  });

  it("spaces signer slots evenly", () => {
    expect(signerSlots(1)).toEqual([0.5]);
    expect(signerSlots(2)).toEqual([0.333, 0.667]);
    expect(signerSlots(3)).toEqual([0.25, 0.5, 0.75]);
    expect(signerSlots(9)).toHaveLength(3);
  });

  it("spreads only the active signer blocks", () => {
    const layout = defaultCertificateLayout(1);
    const spread = spreadSigners(layout, 2);
    expect(spread.signers.map((block) => block.x)).toEqual([0.333, 0.667, layout.signers[2].x]);
  });

  it("falls back to the default for broken stored layouts", () => {
    expect(parseCertificateLayout({ recipientName: "x" })).toEqual(defaultCertificateLayout());
    expect(parseCertificateLayout(null)).toEqual(defaultCertificateLayout());
  });

  it("rejects coordinates outside the page", () => {
    const layout = defaultCertificateLayout();
    layout.recipientName.x = 1.2;
    expect(certificateLayoutSchema.safeParse(layout).success).toBe(false);
  });

  it("clamps nudged coordinates", () => {
    expect(clampCoordinate(-0.01)).toBe(0);
    expect(clampCoordinate(1.004)).toBe(1);
    expect(clampCoordinate(0.12345)).toBe(0.123);
  });
});

describe("default signer positions", () => {
  it("never stacks two blocks at the same x", () => {
    for (const count of [1, 2, 3]) {
      const xs = defaultCertificateLayout(count).signers.slice(0, count).map((block) => block.x);
      expect(new Set(xs).size).toBe(count);
    }
    const xs = defaultCertificateLayout(1).signers.map((block) => block.x);
    expect(new Set(xs).size).toBe(3);
  });
});
