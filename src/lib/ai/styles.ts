export const STYLE_KEYS = ["formal-campus", "minimal", "classic-frame", "modern-geometric", "cheerful"] as const;

export type StyleKey = (typeof STYLE_KEYS)[number];

export const STYLE_LABELS: Record<StyleKey, string> = {
  "formal-campus": "Formal kampus",
  minimal: "Minimalis",
  "classic-frame": "Bingkai klasik",
  "modern-geometric": "Geometris modern",
  cheerful: "Ceria",
};
