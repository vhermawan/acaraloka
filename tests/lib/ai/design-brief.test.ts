import { describe, expect, it } from "vitest";

import {
  aiDesignBriefSchema,
  briefInputSchema,
  toCertificateLayout,
  withReadableText,
  type AiDesignBrief,
} from "@/lib/ai/design-brief";
import { LAYOUT_PRESETS } from "@/lib/ai/layout-presets";
import { presetBriefFor } from "@/lib/ai/style-presets";
import { STYLE_KEYS } from "@/lib/ai/styles";
import { certificateLayoutSchema, defaultCertificateLayout } from "@/lib/certificate-layout";

const validBrief: AiDesignBrief = {
  palette: { primary: "#166534", secondary: "#ca8a04", background: "#f0fdf4", text: "#14532d" },
  accent: "forest",
  fonts: { heading: "cinzel", name: "prata", body: "crimson" },
  layoutPreset: "centered-classic",
  motifs: ["leaf outlines"],
  visualDescription: "Delicate leaf outlines along the border with soft green gradient corners on a pale mint surface.",
};

describe("aiDesignBriefSchema", () => {
  it("accepts a valid brief", () => {
    expect(aiDesignBriefSchema.safeParse(validBrief).success).toBe(true);
  });

  it.each([
    ["font outside FONT_FAMILIES roles", { ...validBrief, fonts: { ...validBrief.fonts, heading: "comic-sans" } }],
    ["font not allowed for the role", { ...validBrief, fonts: { ...validBrief.fonts, body: "great-vibes" } }],
    ["unknown preset", { ...validBrief, layoutPreset: "free-form" }],
    ["bad hex", { ...validBrief, palette: { ...validBrief.palette, text: "red" } }],
    ["visualDescription over max length", { ...validBrief, visualDescription: "x".repeat(401) }],
    ["too many motifs", { ...validBrief, motifs: ["a", "b", "c", "d", "e", "f"] }],
  ])("rejects %s", (_name, value) => {
    expect(aiDesignBriefSchema.safeParse(value).success).toBe(false);
  });
});

describe("briefInputSchema", () => {
  it("limits the organizer note to 150 characters", () => {
    const base = { eventTitle: "Seminar", style: "minimal", primaryColor: null, hasLogo: false };
    expect(briefInputSchema.safeParse({ ...base, organizerNote: "x".repeat(150) }).success).toBe(true);
    expect(briefInputSchema.safeParse({ ...base, organizerNote: "x".repeat(151) }).success).toBe(false);
  });
});

describe("style presets", () => {
  it.each(STYLE_KEYS)("%s is a valid brief", (style) => {
    expect(aiDesignBriefSchema.safeParse(presetBriefFor(style, null)).success).toBe(true);
  });

  it("applies the requested primary color without mutating the shared preset", () => {
    expect(presetBriefFor("minimal", "#123456").palette.primary).toBe("#123456");
    expect(presetBriefFor("minimal", null).palette.primary).not.toBe("#123456");
  });
});

describe("toCertificateLayout", () => {
  it("takes positions from the preset and colors from the palette", () => {
    const layout = toCertificateLayout(validBrief, defaultCertificateLayout(2), 2);
    const preset = LAYOUT_PRESETS["centered-classic"];
    expect(layout.recipientName).toMatchObject({ x: preset.recipientName.x, y: preset.recipientName.y, color: "#14532d" });
    expect(layout.eventDate.color).toBe("#14532d");
    expect(layout.labels.recipientPrefix.color).toBe("#14532d");
    expect(layout.theme).toMatchObject({ accent: "forest", fonts: validBrief.fonts });
    expect(layout.signers.slice(0, 2).map((signer) => signer.x)).toEqual([0.33, 0.67]);
    expect(certificateLayoutSchema.safeParse(layout).success).toBe(true);
  });

  it("keeps label texts, heading visibility and border from the current layout", () => {
    const current = defaultCertificateLayout(1);
    current.labels.heading.text = "PIAGAM";
    current.labels.eventPrefix.text = "";
    current.heading.visible = false;
    current.theme.border = "thin";
    const layout = toCertificateLayout({ ...validBrief, layoutPreset: "left-panel" }, current, 1);
    expect(layout.labels.heading.text).toBe("PIAGAM");
    expect(layout.labels.eventPrefix.text).toBe("");
    expect(layout.heading.visible).toBe(false);
    expect(layout.theme.border).toBe("thin");
    expect(layout.recipientName.align).toBe("left");
  });

  it.each([0, 1, 2, 3, 9])("always yields three signer blocks for %d signers", (count) => {
    expect(toCertificateLayout(validBrief, defaultCertificateLayout(1), count).signers).toHaveLength(3);
  });
});

describe("withReadableText", () => {
  it("turns dark text into light text on a dark generated background", () => {
    const { brief, contrast } = withReadableText(
      { ...validBrief, palette: { ...validBrief.palette, text: "#1c1c1f" } },
      { r: 10, g: 14, b: 30 },
    );
    expect(brief.palette.text).toBe("#ffffff");
    expect(contrast.adjusted).toBe(true);
    expect(contrast.ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("returns the same brief when contrast is already fine", () => {
    const { brief, contrast } = withReadableText(validBrief, { r: 240, g: 253, b: 244 });
    expect(brief).toBe(validBrief);
    expect(contrast.adjusted).toBe(false);
  });
});
