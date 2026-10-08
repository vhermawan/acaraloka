import { z } from "zod";

export const BUILTIN_TEMPLATE_KEY = "classic";
export const PAGE_WIDTH = 841.89;
export const PAGE_HEIGHT = 595.28;
export const MAX_SIGNERS = 3;
export const NUDGE_STEP = 0.01;

const coordinate = z.number().min(0).max(1);
const align = z.enum(["left", "center", "right"]);

const textElement = z.object({
  x: coordinate,
  y: coordinate,
  fontSize: z.number().int().min(8).max(72),
  align,
});

const signerBlock = z.object({
  x: coordinate,
  y: coordinate,
  fontSize: z.number().int().min(8).max(24),
});

const qrElement = z.object({
  x: coordinate,
  y: coordinate,
  size: z.number().min(0.06).max(0.25),
});

export const BORDER_PRESETS = {
  classic: "Garis ganda",
  thin: "Garis tipis",
  corners: "Ornamen sudut",
  none: "Tanpa border",
} as const;

export const ACCENT_COLORS = {
  teal: { label: "Teal", hex: "#0f766e" },
  navy: { label: "Biru tua", hex: "#1e3a8a" },
  burgundy: { label: "Merah marun", hex: "#9f1239" },
  forest: { label: "Hijau hutan", hex: "#166534" },
  violet: { label: "Ungu", hex: "#6d28d9" },
  bronze: { label: "Cokelat emas", hex: "#92400e" },
} as const;

export const FONT_FAMILIES = {
  times: "Times",
  helvetica: "Helvetica",
  prata: "Prata",
  cinzel: "Cinzel",
  crimson: "Crimson Text",
  jakarta: "Plus Jakarta Sans",
  "great-vibes": "Great Vibes",
} as const;

export type BorderKey = keyof typeof BORDER_PRESETS;
export type AccentKey = keyof typeof ACCENT_COLORS;
export type FontKey = keyof typeof FONT_FAMILIES;
export type FontRole = "heading" | "name" | "body";

export const FONT_ROLE_OPTIONS: Record<FontRole, readonly [FontKey, ...FontKey[]]> = {
  heading: ["times", "prata", "cinzel", "crimson", "jakarta"],
  name: ["times", "prata", "cinzel", "crimson", "jakarta", "great-vibes"],
  body: ["helvetica", "times", "crimson", "jakarta"],
};

export const FONT_ROLE_LABELS: Record<FontRole, string> = {
  heading: "Judul",
  name: "Nama peserta",
  body: "Teks lain",
};

const borderKeys = Object.keys(BORDER_PRESETS) as [BorderKey, ...BorderKey[]];
const accentKeys = Object.keys(ACCENT_COLORS) as [AccentKey, ...AccentKey[]];

const themeSchema = z.object({
  border: z.enum(borderKeys).default("classic"),
  accent: z.enum(accentKeys).default("teal"),
  fonts: z
    .object({
      heading: z.enum(FONT_ROLE_OPTIONS.heading).default("times"),
      name: z.enum(FONT_ROLE_OPTIONS.name).default("times"),
      body: z.enum(FONT_ROLE_OPTIONS.body).default("helvetica"),
    })
    .prefault({}),
});

export const certificateLayoutSchema = z.object({
  theme: themeSchema.prefault({}),
  recipientName: textElement,
  certificateNumber: textElement,
  eventTitle: textElement,
  eventDate: textElement,
  signers: z.array(signerBlock).length(MAX_SIGNERS),
  verifyQr: qrElement,
});

export type CertificateLayout = z.infer<typeof certificateLayoutSchema>;
export type CertificateTheme = CertificateLayout["theme"];
export type TextElementKey = "recipientName" | "certificateNumber" | "eventTitle" | "eventDate";
export type TextAlign = z.infer<typeof align>;

export const TEXT_ELEMENT_LABELS: Record<TextElementKey, string> = {
  recipientName: "Nama peserta",
  eventTitle: "Nama acara",
  eventDate: "Tanggal acara",
  certificateNumber: "Nomor sertifikat",
};

export function signerSlots(count: number): number[] {
  const n = Math.min(Math.max(count, 1), MAX_SIGNERS);
  return Array.from({ length: n }, (_, index) => Number(((index + 1) / (n + 1)).toFixed(3)));
}

export function defaultCertificateTheme(): CertificateTheme {
  return { border: "classic", accent: "teal", fonts: { heading: "times", name: "times", body: "helvetica" } };
}

export function defaultCertificateLayout(signerCount = 1): CertificateLayout {
  const slots = signerSlots(signerCount);
  return {
    theme: defaultCertificateTheme(),
    recipientName: { x: 0.5, y: 0.45, fontSize: 36, align: "center" },
    eventTitle: { x: 0.5, y: 0.56, fontSize: 16, align: "center" },
    eventDate: { x: 0.5, y: 0.61, fontSize: 12, align: "center" },
    certificateNumber: { x: 0.5, y: 0.31, fontSize: 10, align: "center" },
    signers: Array.from({ length: MAX_SIGNERS }, (_, index) => ({
      x: slots[index] ?? signerSlots(index + 1)[index],
      y: 0.8,
      fontSize: 11,
    })),
    verifyQr: { x: 0.885, y: 0.8, size: 0.1 },
  };
}

export function parseCertificateLayout(value: unknown): CertificateLayout {
  const parsed = certificateLayoutSchema.safeParse(value);
  return parsed.success ? parsed.data : defaultCertificateLayout();
}

export function clampCoordinate(value: number): number {
  return Math.round(Math.min(1, Math.max(0, value)) * 1000) / 1000;
}

export function spreadSigners(layout: CertificateLayout, count: number): CertificateLayout {
  const slots = signerSlots(count);
  return {
    ...layout,
    signers: layout.signers.map((block, index) => (index < slots.length ? { ...block, x: slots[index] } : block)),
  };
}
