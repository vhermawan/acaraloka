import { PAGE_HEIGHT, PAGE_WIDTH } from "@/lib/certificate-layout";

export const BACKGROUND_MAX_BYTES = 3 * 1024 * 1024;
export const BACKGROUND_CONTENT_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
} as const;
export const BACKGROUND_RATIO_TOLERANCE = 0.02;
export const BACKGROUND_MIN_WIDTH = Math.floor(1754 * (1 - BACKGROUND_RATIO_TOLERANCE));

export type BackgroundContentType = keyof typeof BACKGROUND_CONTENT_TYPES;
export type BackgroundExtension = (typeof BACKGROUND_CONTENT_TYPES)[BackgroundContentType];

export const PAGE_FORMATS = {
  a4: { label: "A4 lanskap", width: PAGE_WIDTH, height: PAGE_HEIGHT, suggested: { width: 2480, height: 1754 } },
  wide: { label: "16:9", width: PAGE_WIDTH, height: 473.56, suggested: { width: 1920, height: 1080 } },
} as const;

export type PageFormatKey = keyof typeof PAGE_FORMATS;

export const BACKGROUND_SIZE_HINT = (Object.values(PAGE_FORMATS) as (typeof PAGE_FORMATS)[PageFormatKey][])
  .map((format) => `${format.suggested.width}×${format.suggested.height} px (${format.label})`)
  .join(" atau ");

export function pageSizeFor(format: PageFormatKey) {
  const { width, height } = PAGE_FORMATS[format];
  return { width, height };
}

export function detectPageFormat(width: number, height: number): PageFormatKey | null {
  if (!(width > 0) || !(height > 0)) return null;
  const ratio = width / height;
  for (const key of Object.keys(PAGE_FORMATS) as PageFormatKey[]) {
    const target = PAGE_FORMATS[key].width / PAGE_FORMATS[key].height;
    if (Math.abs(ratio - target) / target <= BACKGROUND_RATIO_TOLERANCE) return key;
  }
  return null;
}

export function validateBackgroundFile(contentType: string, size: number): string | null {
  if (!(contentType in BACKGROUND_CONTENT_TYPES)) return "Gambar latar harus berformat PNG atau JPG.";
  if (size <= 0 || size > BACKGROUND_MAX_BYTES) return "Ukuran gambar latar maksimal 3 MB.";
  return null;
}

export type BackgroundDimensionsResult = { ok: true; format: PageFormatKey } | { ok: false; error: string };

export function validateBackgroundDimensions(width: number, height: number): BackgroundDimensionsResult {
  const format = detectPageFormat(width, height);
  if (!format) {
    return { ok: false, error: `Rasio gambar harus A4 lanskap atau 16:9. Ukuran yang disarankan: ${BACKGROUND_SIZE_HINT}.` };
  }
  if (width < BACKGROUND_MIN_WIDTH) {
    return { ok: false, error: `Resolusi terlalu kecil. Ukuran yang disarankan: ${BACKGROUND_SIZE_HINT}.` };
  }
  return { ok: true, format };
}

export function backgroundFormat(path: string): "jpg" | "png" {
  return path.toLowerCase().endsWith(".png") ? "png" : "jpg";
}

const BACKGROUND_PATH_PATTERN = /^events\/([A-Za-z0-9_-]+)\/[0-9a-f]{16}\.(jpg|png)$/;

export function isBackgroundPathFor(eventId: string, path: string): boolean {
  const match = BACKGROUND_PATH_PATTERN.exec(path);
  return match !== null && match[1] === eventId;
}

export function isBackgroundPath(path: string): boolean {
  return BACKGROUND_PATH_PATTERN.test(path);
}

export function hasBackgroundSignature(bytes: Uint8Array, extension: "jpg" | "png"): boolean {
  if (extension === "png") {
    return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  }
  return [0xff, 0xd8, 0xff].every((value, index) => bytes[index] === value);
}
