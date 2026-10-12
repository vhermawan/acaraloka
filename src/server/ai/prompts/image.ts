import "server-only";

import { LAYOUT_PRESETS, percent, type Rect } from "@/lib/ai/layout-presets";
import { STYLE_FRAGMENTS } from "@/server/ai/prompts/styles";
import type { PromptSpec } from "@/server/ai/types";

export const IMAGE_PROMPT_VERSION = "m3-1";

function span(rect: Rect) {
  return {
    left: percent(rect.x),
    right: percent(rect.x + rect.width),
    top: percent(rect.y),
    bottom: percent(rect.y + rect.height),
  };
}

export function safeAreaSentence(rect: Rect): string {
  const area = span(rect);
  return `Keep the rectangle from ${area.left}% to ${area.right}% of the width and from ${area.top}% to ${area.bottom}% of the height completely plain; ornaments live only outside it.`;
}

export function logoSlotSentence(rect: Rect): string {
  const area = span(rect);
  return `Reserve an empty zone at the top center, from ${area.left}% to ${area.right}% of the width and from ${area.top}% to ${area.bottom}% of the height. Inside this zone and in a small margin around it paint only the same plain background surface: no frame, box, outline, circle, badge, shield, seal or placeholder shape, and the border ornaments along the top edge must stop before the zone and resume after it.`;
}

export function imagePrompt({ style, brief }: PromptSpec): string {
  const preset = LAYOUT_PRESETS[brief.layoutPreset];
  const { palette } = brief;
  return [
    "Decorative certificate background, landscape, print-ready flat artwork.",
    `Style: ${STYLE_FRAGMENTS[style]}.`,
    `Color palette: primary ${palette.primary}, secondary ${palette.secondary}, background ${palette.background}.`,
    `Motifs: ${brief.motifs.join(", ") || "none"}. ${brief.visualDescription}`,
    "Composition: ornaments and textures only along the outer border and corners, keeping a 4% clean margin at every edge.",
    safeAreaSentence(preset.safeArea),
    logoSlotSentence(preset.logoSlot),
    "The central area is a smooth, plain, low-contrast surface with nothing in it, reserved for text that will be added later.",
    "For religious or cultural themes use only abstract geometric patterns, such as Islamic 8-point or 12-point star tessellations, or neutral decorative motifs. Never draw six-pointed stars or hexagrams.",
    "Do NOT draw any text, letters, numbers, words, monograms, logos, emblems, seals, stamps, signatures, QR codes, watermarks, people, faces, empty frames or placeholder boxes.",
    "No mockup, no perspective, no paper photo, no drop shadow.",
  ].join("\n");
}
