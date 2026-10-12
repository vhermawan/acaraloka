import { z } from "zod";

import { resolveReadableText, type ReadableText, type Rgb } from "@/lib/ai/contrast";
import { LAYOUT_PRESET_KEYS, LAYOUT_PRESETS } from "@/lib/ai/layout-presets";
import { STYLE_KEYS, type StyleKey } from "@/lib/ai/styles";
import {
  ACCENT_COLORS,
  FONT_ROLE_OPTIONS,
  HEX_COLOR_PATTERN,
  MAX_SIGNERS,
  certificateLayoutSchema,
  type AccentKey,
  type CertificateLayout,
} from "@/lib/certificate-layout";

const hex = z.string().regex(HEX_COLOR_PATTERN);
const accentKeys = Object.keys(ACCENT_COLORS) as [AccentKey, ...AccentKey[]];

export const aiDesignBriefSchema = z.object({
  palette: z.object({ primary: hex, secondary: hex, background: hex, text: hex }),
  accent: z.enum(accentKeys),
  fonts: z.object({
    heading: z.enum(FONT_ROLE_OPTIONS.heading),
    name: z.enum(FONT_ROLE_OPTIONS.name),
    body: z.enum(FONT_ROLE_OPTIONS.body),
  }),
  layoutPreset: z.enum(LAYOUT_PRESET_KEYS),
  motifs: z.array(z.string().max(40)).max(5),
  visualDescription: z.string().min(40).max(400),
});

export type AiDesignBrief = z.infer<typeof aiDesignBriefSchema>;

export const briefInputSchema = z.object({
  eventTitle: z.string().min(1).max(200),
  style: z.enum(STYLE_KEYS),
  primaryColor: hex.nullable(),
  hasLogo: z.boolean(),
  organizerNote: z.string().max(150),
});

export type BriefInput = z.infer<typeof briefInputSchema>;
export type { StyleKey };

export function toCertificateLayout(
  brief: AiDesignBrief,
  current: CertificateLayout,
  signerCount: number,
): CertificateLayout {
  const preset = LAYOUT_PRESETS[brief.layoutPreset];
  const count = Math.min(Math.max(Math.trunc(signerCount), 1), MAX_SIGNERS) as 1 | 2 | 3;
  const color = brief.palette.text;
  const fallbackXs = preset.signerXs[3];
  const xs = preset.signerXs[count];

  return certificateLayoutSchema.parse({
    theme: { border: current.theme.border, accent: brief.accent, fonts: brief.fonts },
    labels: {
      heading: { text: current.labels.heading.text, color },
      recipientPrefix: { text: current.labels.recipientPrefix.text, color },
      eventPrefix: { text: current.labels.eventPrefix.text, color },
    },
    heading: { ...preset.heading, visible: current.heading.visible },
    recipientName: { ...preset.recipientName, color },
    certificateNumber: { ...preset.certificateNumber, color },
    eventTitle: { ...preset.eventTitle, color },
    eventDate: { ...preset.eventDate, color },
    signers: Array.from({ length: MAX_SIGNERS }, (_, index) => ({
      x: xs[index] ?? fallbackXs[index] ?? 0.5,
      y: preset.signerY,
      fontSize: preset.signerFontSize,
    })),
    verifyQr: preset.verifyQr,
    inkColor: color,
  });
}

export function withReadableText(brief: AiDesignBrief, background: Rgb): { brief: AiDesignBrief; contrast: ReadableText } {
  const contrast = resolveReadableText(brief.palette.text, background);
  if (!contrast.adjusted) return { brief, contrast };
  return { brief: { ...brief, palette: { ...brief.palette, text: contrast.color } }, contrast };
}
