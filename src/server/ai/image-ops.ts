import "server-only";

import sharp from "sharp";

import type { Rgb } from "@/lib/ai/contrast";
import type { Rect } from "@/lib/ai/layout-presets";

export const A4_LANDSCAPE = { width: 2480, height: 1754 } as const;
export const MAX_INPUT_PIXELS = 64_000_000;
export const JPEG_QUALITIES = [88, 80, 72, 64, 56, 48] as const;

export class ImageOpsError extends Error {
  constructor(
    message: string,
    readonly code: "UNREADABLE" | "TOO_LARGE",
  ) {
    super(message);
    this.name = "ImageOpsError";
  }
}

export type NormalizedCertificate = {
  bytes: Uint8Array;
  mime: "image/jpeg";
  width: number;
  height: number;
  source: { width: number; height: number; format: string };
  upscaled: boolean;
};

function open(input: Uint8Array) {
  return sharp(input, { limitInputPixels: MAX_INPUT_PIXELS });
}

export async function readImageDimensions(input: Uint8Array): Promise<{ width: number; height: number; format: string }> {
  try {
    const meta = await open(input).metadata();
    if (!meta.width || !meta.height) throw new ImageOpsError("Image has no readable dimensions", "UNREADABLE");
    return { width: meta.width, height: meta.height, format: meta.format ?? "unknown" };
  } catch (error) {
    if (error instanceof ImageOpsError) throw error;
    throw new ImageOpsError("Image cannot be decoded", "UNREADABLE");
  }
}

export async function normalizeCertificate(input: Uint8Array, maxBytes: number): Promise<NormalizedCertificate> {
  const source = await readImageDimensions(input);
  const targetRatio = A4_LANDSCAPE.width / A4_LANDSCAPE.height;

  let cropWidth = source.width;
  let cropHeight = source.height;
  if (source.width / source.height > targetRatio) cropWidth = Math.round(source.height * targetRatio);
  else cropHeight = Math.round(source.width / targetRatio);
  const left = Math.floor((source.width - cropWidth) / 2);
  const top = Math.floor((source.height - cropHeight) / 2);

  try {
    const prepared = open(input)
      .rotate()
      .extract({ left, top, width: cropWidth, height: cropHeight })
      .resize(A4_LANDSCAPE.width, A4_LANDSCAPE.height, { kernel: "lanczos3" })
      .flatten({ background: "#ffffff" });

    for (const quality of JPEG_QUALITIES) {
      const output = await prepared.clone().jpeg({ quality, mozjpeg: true }).toBuffer();
      if (output.byteLength <= maxBytes) {
        return {
          bytes: new Uint8Array(output),
          mime: "image/jpeg",
          width: A4_LANDSCAPE.width,
          height: A4_LANDSCAPE.height,
          source,
          upscaled: cropWidth < A4_LANDSCAPE.width || cropHeight < A4_LANDSCAPE.height,
        };
      }
    }
  } catch {
    throw new ImageOpsError("Image cannot be processed", "UNREADABLE");
  }
  throw new ImageOpsError(`Image still exceeds ${maxBytes} bytes at the lowest JPEG quality`, "TOO_LARGE");
}

export async function sampleAverageColor(input: Uint8Array, area: Rect): Promise<Rgb> {
  const { width, height } = await readImageDimensions(input);
  const left = Math.max(0, Math.floor(area.x * width));
  const top = Math.max(0, Math.floor(area.y * height));
  const regionWidth = Math.max(1, Math.min(width - left, Math.round(area.width * width)));
  const regionHeight = Math.max(1, Math.min(height - top, Math.round(area.height * height)));
  const region = await open(input)
    .extract({ left, top, width: regionWidth, height: regionHeight })
    .flatten({ background: "#ffffff" })
    .toColourspace("srgb")
    .png()
    .toBuffer();
  const { channels } = await sharp(region).stats();
  const [red, green, blue] = channels;
  if (!red || !green || !blue) throw new ImageOpsError("Image has no color channels", "UNREADABLE");
  return { r: Math.round(red.mean), g: Math.round(green.mean), b: Math.round(blue.mean) };
}
