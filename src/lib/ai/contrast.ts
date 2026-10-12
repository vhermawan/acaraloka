export type Rgb = { r: number; g: number; b: number };

export const MIN_TEXT_CONTRAST = 4.5;
export const DARK_TEXT = "#1c1c1f";
export const LIGHT_TEXT = "#ffffff";

export function hexToRgb(hex: string): Rgb {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}

function channel(value: number): number {
  const scaled = value / 255;
  return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(color: Rgb): number {
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

export function contrastRatio(first: Rgb, second: Rgb): number {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export type ReadableText = { color: string; ratio: number; adjusted: boolean };

export function resolveReadableText(textHex: string, background: Rgb, minRatio = MIN_TEXT_CONTRAST): ReadableText {
  const current = contrastRatio(hexToRgb(textHex), background);
  if (current >= minRatio) return { color: textHex, ratio: current, adjusted: false };
  const dark = contrastRatio(hexToRgb(DARK_TEXT), background);
  const light = contrastRatio(hexToRgb(LIGHT_TEXT), background);
  return dark >= light
    ? { color: DARK_TEXT, ratio: dark, adjusted: true }
    : { color: LIGHT_TEXT, ratio: light, adjusted: true };
}
