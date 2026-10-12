import { randomBytes } from "node:crypto";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { BACKGROUND_MAX_BYTES, hasBackgroundSignature, validateBackgroundDimensions } from "@/lib/certificate-background";
import {
  A4_LANDSCAPE,
  ImageOpsError,
  normalizeCertificate,
  readImageDimensions,
  sampleAverageColor,
} from "@/server/ai/image-ops";

async function solid(width: number, height: number, color: string, format: "png" | "jpeg" = "png") {
  const image = sharp({ create: { width, height, channels: 3, background: color } });
  return new Uint8Array(await (format === "png" ? image.png() : image.jpeg()).toBuffer());
}

describe("normalizeCertificate", () => {
  it("center-crops a 3:2 Vertex-sized image to A4 landscape JPEG", async () => {
    const result = await normalizeCertificate(await solid(2528, 1696, "#336699"), BACKGROUND_MAX_BYTES);
    expect(result).toMatchObject({ mime: "image/jpeg", width: 2480, height: 1754, upscaled: true });
    expect(result.source).toEqual({ width: 2528, height: 1696, format: "png" });
    expect(hasBackgroundSignature(result.bytes, "jpg")).toBe(true);
    expect(validateBackgroundDimensions(result.width, result.height).ok).toBe(true);
    const meta = await sharp(result.bytes).metadata();
    expect([meta.width, meta.height, meta.format]).toEqual([2480, 1754, "jpeg"]);
  });

  it("crops by width when the source is wider than A4", async () => {
    const result = await normalizeCertificate(await solid(3000, 1200, "#ffffff"), BACKGROUND_MAX_BYTES);
    expect([result.width, result.height]).toEqual([A4_LANDSCAPE.width, A4_LANDSCAPE.height]);
  });

  it("crops the center, not a corner", async () => {
    const left = await sharp({ create: { width: 1000, height: 707, channels: 3, background: "#ff0000" } }).png().toBuffer();
    const base = sharp({ create: { width: 1200, height: 707, channels: 3, background: "#0000ff" } });
    const input = new Uint8Array(await base.composite([{ input: left, left: 100, top: 0 }]).png().toBuffer());
    const result = await normalizeCertificate(input, BACKGROUND_MAX_BYTES);
    const sample = await sampleAverageColor(result.bytes, { x: 0, y: 0, width: 1, height: 1 });
    expect(sample.r).toBeGreaterThan(200);
    expect(sample.b).toBeLessThan(60);
  });

  it("lowers JPEG quality to fit the byte limit", async () => {
    const noise = new Uint8Array(
      await sharp(randomBytes(1200 * 850 * 3), { raw: { width: 1200, height: 850, channels: 3 } })
        .png()
        .toBuffer(),
    );
    const generous = await normalizeCertificate(noise, 50 * 1024 * 1024);
    const limit = Math.floor(generous.bytes.byteLength * 0.8);
    const tight = await normalizeCertificate(noise, limit);
    expect(tight.bytes.byteLength).toBeLessThanOrEqual(limit);
    expect(tight.bytes.byteLength).toBeLessThan(generous.bytes.byteLength);
  });

  it("rejects an output that cannot fit the byte limit", async () => {
    const noise = new Uint8Array(
      await sharp(randomBytes(800 * 566 * 3), { raw: { width: 800, height: 566, channels: 3 } })
        .png()
        .toBuffer(),
    );
    await expect(normalizeCertificate(noise, 10_000)).rejects.toMatchObject({ name: "ImageOpsError", code: "TOO_LARGE" });
  });

  it("crops after applying EXIF orientation 5-8", async () => {
    const input = new Uint8Array(
      await sharp({ create: { width: 1600, height: 900, channels: 3, background: "#336699" } })
        .jpeg()
        .withMetadata({ orientation: 6 })
        .toBuffer(),
    );
    const result = await normalizeCertificate(input, BACKGROUND_MAX_BYTES);
    expect(result.source).toMatchObject({ width: 900, height: 1600 });
    expect([result.width, result.height]).toEqual([2480, 1754]);
    const meta = await sharp(result.bytes).metadata();
    expect([meta.width, meta.height]).toEqual([2480, 1754]);
  });

  it("rejects bytes that are not an image", async () => {
    await expect(normalizeCertificate(new Uint8Array([1, 2, 3, 4]), BACKGROUND_MAX_BYTES)).rejects.toBeInstanceOf(ImageOpsError);
  });
});

describe("readImageDimensions", () => {
  it("reads dimensions and format", async () => {
    expect(await readImageDimensions(await solid(30, 20, "#000000", "jpeg"))).toEqual({ width: 30, height: 20, format: "jpeg" });
  });

  it("throws UNREADABLE for garbage", async () => {
    await expect(readImageDimensions(new Uint8Array(10))).rejects.toMatchObject({ code: "UNREADABLE" });
  });
});

describe("sampleAverageColor", () => {
  it("averages only the requested area", async () => {
    const left = await sharp({ create: { width: 100, height: 100, channels: 3, background: "#ffffff" } }).png().toBuffer();
    const input = new Uint8Array(
      await sharp({ create: { width: 200, height: 100, channels: 3, background: "#000000" } })
        .composite([{ input: left, left: 0, top: 0 }])
        .png()
        .toBuffer(),
    );
    expect(await sampleAverageColor(input, { x: 0, y: 0, width: 0.5, height: 1 })).toEqual({ r: 255, g: 255, b: 255 });
    expect(await sampleAverageColor(input, { x: 0.5, y: 0, width: 0.5, height: 1 })).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("clamps areas that extend past the image", async () => {
    const color = await sampleAverageColor(await solid(50, 50, "#808080"), { x: 0.9, y: 0.9, width: 0.5, height: 0.5 });
    expect(color.r).toBeGreaterThan(120);
  });
});
