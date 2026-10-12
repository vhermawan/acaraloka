import type { AiDesignBrief } from "@/lib/ai/design-brief";
import type { StyleKey } from "@/lib/ai/styles";

export const STYLE_PRESET_BRIEFS: Record<StyleKey, AiDesignBrief> = {
  "formal-campus": {
    palette: { primary: "#1e3a8a", secondary: "#b8923a", background: "#fbf9f3", text: "#1c1c1f" },
    accent: "navy",
    fonts: { heading: "cinzel", name: "prata", body: "crimson" },
    layoutPreset: "centered-classic",
    motifs: ["fine guilloche lines", "laurel corners"],
    visualDescription:
      "Elegant academic border with fine guilloche lines and subtle laurel corner ornaments in navy and muted gold on warm ivory paper.",
  },
  minimal: {
    palette: { primary: "#374151", secondary: "#9ca3af", background: "#ffffff", text: "#1c1c1f" },
    accent: "teal",
    fonts: { heading: "jakarta", name: "jakarta", body: "jakarta" },
    layoutPreset: "centered-airy",
    motifs: ["hairline corner marks"],
    visualDescription:
      "Clean minimalist surface with thin hairline corner marks, generous whitespace and soft neutral grey tones on white.",
  },
  "classic-frame": {
    palette: { primary: "#7f1d1d", secondary: "#a16207", background: "#f7efdc", text: "#1c1c1f" },
    accent: "burgundy",
    fonts: { heading: "times", name: "great-vibes", body: "times" },
    layoutPreset: "centered-classic",
    motifs: ["engraved flourishes", "ornate frame"],
    visualDescription:
      "Classic ornate framed border with engraved flourishes in burgundy and antique gold over a vintage parchment-like paper texture.",
  },
  "modern-geometric": {
    palette: { primary: "#0f766e", secondary: "#6d28d9", background: "#f8fafc", text: "#1c1c1f" },
    accent: "teal",
    fonts: { heading: "jakarta", name: "jakarta", body: "helvetica" },
    layoutPreset: "left-panel",
    motifs: ["translucent polygons", "fine lines"],
    visualDescription:
      "Modern geometric composition of overlapping translucent polygons and crisp fine lines gathered on the right side in teal and violet.",
  },
  cheerful: {
    palette: { primary: "#f97316", secondary: "#8b5cf6", background: "#fff7ed", text: "#1c1c1f" },
    accent: "violet",
    fonts: { heading: "jakarta", name: "great-vibes", body: "jakarta" },
    layoutPreset: "centered-airy",
    motifs: ["soft confetti shapes", "organic curves"],
    visualDescription:
      "Playful border of soft rounded confetti shapes and friendly organic curves in warm orange and violet pastels on a cream background.",
  },
};

export function presetBriefFor(style: StyleKey, primaryColor: string | null): AiDesignBrief {
  const base = STYLE_PRESET_BRIEFS[style];
  return {
    ...base,
    palette: { ...base.palette, primary: primaryColor ?? base.palette.primary },
    fonts: { ...base.fonts },
    motifs: [...base.motifs],
  };
}
