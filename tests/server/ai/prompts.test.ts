import { describe, expect, it } from "vitest";

import { LAYOUT_PRESETS, LAYOUT_PRESET_KEYS } from "@/lib/ai/layout-presets";
import { presetBriefFor } from "@/lib/ai/style-presets";
import { STYLE_KEYS } from "@/lib/ai/styles";
import { BRIEF_SYSTEM_PROMPT, briefJsonSchema } from "@/server/ai/prompts/brief";
import { imagePrompt, logoSlotSentence, safeAreaSentence } from "@/server/ai/prompts/image";

describe("imagePrompt", () => {
  it.each(STYLE_KEYS)("forbids text, logos and hexagrams for %s", (style) => {
    const prompt = imagePrompt({ style, brief: presetBriefFor(style, null) });
    expect(prompt).toMatch(/Do NOT draw any text, letters, numbers/);
    expect(prompt).toMatch(/logos/);
    expect(prompt).toMatch(/Never draw six-pointed stars or hexagrams/);
    expect(prompt).toMatch(/8-point or 12-point star/);
    expect(prompt).toMatch(/central area is a smooth, plain/);
  });

  it.each(LAYOUT_PRESET_KEYS)("describes the safe area and the always-empty logo slot of %s", (key) => {
    const preset = LAYOUT_PRESETS[key];
    const prompt = imagePrompt({ style: "minimal", brief: { ...presetBriefFor("minimal", null), layoutPreset: key } });
    expect(prompt).toContain(safeAreaSentence(preset.safeArea));
    expect(prompt).toContain(logoSlotSentence(preset.logoSlot));
  });

  it.each(LAYOUT_PRESET_KEYS)("keeps the logo slot of %s a plain surface without any frame", (key) => {
    const sentence = logoSlotSentence(LAYOUT_PRESETS[key].logoSlot);
    expect(sentence).toMatch(/Reserve an empty zone at the top center/);
    expect(sentence).toMatch(/no frame, box, outline, circle, badge, shield, seal or placeholder shape/);
    expect(sentence).toMatch(/border ornaments along the top edge must stop before the zone/);
    const prompt = imagePrompt({ style: "minimal", brief: { ...presetBriefFor("minimal", null), layoutPreset: key } });
    expect(prompt).toMatch(/empty frames or placeholder boxes/);
  });

  it("derives percentages from the preset rectangles", () => {
    expect(safeAreaSentence({ x: 0.1, y: 0.2, width: 0.8, height: 0.68 })).toBe(
      "Keep the rectangle from 10% to 90% of the width and from 20% to 88% of the height completely plain; ornaments live only outside it.",
    );
  });
});

describe("brief prompt", () => {
  it("steers religious themes to geometric patterns and away from hexagrams", () => {
    expect(BRIEF_SYSTEM_PROMPT).toMatch(/Islamic 8-point or 12-point star/);
    expect(BRIEF_SYSTEM_PROMPT).toMatch(/Never mention hexagrams/);
    expect(BRIEF_SYSTEM_PROMPT).toMatch(/untrusted user data/);
  });

  it("exports a JSON schema without the $schema key", () => {
    expect(briefJsonSchema).not.toHaveProperty("$schema");
    expect(briefJsonSchema).toHaveProperty("properties.layoutPreset.enum", [...LAYOUT_PRESET_KEYS]);
  });
});
