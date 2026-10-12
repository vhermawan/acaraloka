import type { CertificateLayout } from "@/lib/certificate-layout";

export const LAYOUT_PRESET_KEYS = ["centered-classic", "centered-airy", "left-panel"] as const;

export type LayoutPresetKey = (typeof LAYOUT_PRESET_KEYS)[number];

export type Rect = { x: number; y: number; width: number; height: number };

type TextPlacement = CertificateLayout["recipientName"];

export type LayoutPreset = {
  key: LayoutPresetKey;
  logoSlot: Rect;
  safeArea: Rect;
  heading: CertificateLayout["heading"];
  recipientName: TextPlacement;
  certificateNumber: TextPlacement;
  eventTitle: TextPlacement;
  eventDate: TextPlacement;
  signerY: number;
  signerFontSize: number;
  signerXs: Record<1 | 2 | 3, readonly number[]>;
  verifyQr: CertificateLayout["verifyQr"];
};

const LOGO_SLOT: Rect = { x: 0.4, y: 0.04, width: 0.2, height: 0.12 };

export const LAYOUT_PRESETS: Record<LayoutPresetKey, LayoutPreset> = {
  "centered-classic": {
    key: "centered-classic",
    logoSlot: LOGO_SLOT,
    safeArea: { x: 0.1, y: 0.2, width: 0.76, height: 0.68 },
    heading: { visible: true, x: 0.5, y: 0.25, fontSize: 38, align: "center" },
    certificateNumber: { x: 0.5, y: 0.33, fontSize: 10, align: "center", color: null },
    recipientName: { x: 0.5, y: 0.47, fontSize: 36, align: "center", color: null },
    eventTitle: { x: 0.5, y: 0.6, fontSize: 16, align: "center", color: null },
    eventDate: { x: 0.5, y: 0.66, fontSize: 12, align: "center", color: null },
    signerY: 0.8,
    signerFontSize: 11,
    signerXs: { 1: [0.5], 2: [0.33, 0.67], 3: [0.2, 0.46, 0.72] },
    verifyQr: { x: 0.915, y: 0.8, size: 0.08 },
  },
  "centered-airy": {
    key: "centered-airy",
    logoSlot: LOGO_SLOT,
    safeArea: { x: 0.08, y: 0.18, width: 0.78, height: 0.72 },
    heading: { visible: true, x: 0.5, y: 0.27, fontSize: 34, align: "center" },
    certificateNumber: { x: 0.5, y: 0.35, fontSize: 10, align: "center", color: null },
    recipientName: { x: 0.5, y: 0.5, fontSize: 40, align: "center", color: null },
    eventTitle: { x: 0.5, y: 0.63, fontSize: 16, align: "center", color: null },
    eventDate: { x: 0.5, y: 0.69, fontSize: 12, align: "center", color: null },
    signerY: 0.82,
    signerFontSize: 11,
    signerXs: { 1: [0.5], 2: [0.33, 0.67], 3: [0.2, 0.46, 0.72] },
    verifyQr: { x: 0.915, y: 0.82, size: 0.08 },
  },
  "left-panel": {
    key: "left-panel",
    logoSlot: LOGO_SLOT,
    safeArea: { x: 0.03, y: 0.2, width: 0.64, height: 0.68 },
    heading: { visible: true, x: 0.07, y: 0.26, fontSize: 34, align: "left" },
    certificateNumber: { x: 0.07, y: 0.34, fontSize: 10, align: "left", color: null },
    recipientName: { x: 0.07, y: 0.47, fontSize: 34, align: "left", color: null },
    eventTitle: { x: 0.07, y: 0.6, fontSize: 15, align: "left", color: null },
    eventDate: { x: 0.07, y: 0.66, fontSize: 12, align: "left", color: null },
    signerY: 0.8,
    signerFontSize: 11,
    signerXs: { 1: [0.2], 2: [0.14, 0.36], 3: [0.13, 0.32, 0.51] },
    verifyQr: { x: 0.9, y: 0.8, size: 0.08 },
  },
};

export function percent(value: number): number {
  return Math.round(value * 100);
}
