import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { BACKGROUND_MAX_BYTES, hasBackgroundSignature, validateBackgroundDimensions } from "@/lib/certificate-background";
import {
  A4_LANDSCAPE,
  ImageOpsError,
  compositeLogo,
  makeThumbnail,
  normalizeCertificate,
  normalizeLogo,
  readImageDimensions,
  sampleAverageColor,
} from "@/server/ai/image-ops";

const NOISE_TIMEOUT_MS = 60_000;

function seededNoise(length: number, seed: number): Buffer {
  const bytes = Buffer.alloc(length);
  let state = seed >>> 0;
  for (let index = 0; index < length; index += 1) {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    bytes[index] = ((mixed ^ (mixed >>> 14)) >>> 0) & 0xff;
  }
  return bytes;
}

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

  it("lowers JPEG quality to fit the byte limit", { timeout: NOISE_TIMEOUT_MS }, async () => {
    const noise = new Uint8Array(
      await sharp(seededNoise(1200 * 850 * 3, 1), { raw: { width: 1200, height: 850, channels: 3 } })
        .png()
        .toBuffer(),
    );
    const generous = await normalizeCertificate(noise, 50 * 1024 * 1024);
    const limit = Math.floor(generous.bytes.byteLength * 0.8);
    const tight = await normalizeCertificate(noise, limit);
    expect(tight.bytes.byteLength).toBeLessThanOrEqual(limit);
    expect(tight.bytes.byteLength).toBeLessThan(generous.bytes.byteLength);
  });

  it("rejects an output that cannot fit the byte limit", { timeout: NOISE_TIMEOUT_MS }, async () => {
    const noise = new Uint8Array(
      await sharp(seededNoise(800 * 566 * 3, 2), { raw: { width: 800, height: 566, channels: 3 } })
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

describe("makeThumbnail", () => {
  it("scales a certificate down to a 480 px JPEG", async () => {
    const thumb = await makeThumbnail(await solid(2480, 1754, "#336699", "jpeg"));
    const meta = await sharp(thumb).metadata();
    expect([meta.width, meta.format]).toEqual([480, "jpeg"]);
  });
});

describe("normalizeLogo", () => {
  async function logoPng(width: number, height: number) {
    return new Uint8Array(
      await sharp({ create: { width, height, channels: 4, background: { r: 200, g: 20, b: 20, alpha: 0.5 } } })
        .withMetadata({ exif: { IFD0: { Copyright: "secret" } } })
        .png()
        .toBuffer(),
    );
  }

  it("re-encodes to a PNG without metadata and caps the longest side", async () => {
    const result = await normalizeLogo(await logoPng(3000, 1500));
    expect([result.width, result.height]).toEqual([1024, 512]);
    const meta = await sharp(result.bytes).metadata();
    expect(meta.format).toBe("png");
    expect(meta.exif).toBeUndefined();
    expect(meta.hasAlpha).toBe(true);
  });

  it("accepts a JPEG and returns a PNG", async () => {
    const result = await normalizeLogo(await solid(400, 400, "#00aa00", "jpeg"));
    expect((await sharp(result.bytes).metadata()).format).toBe("png");
  });

  it.each([
    ["too small", 32, 32],
    ["too large", 4100, 100],
  ])("rejects a logo that is %s", async (_name, width, height) => {
    await expect(normalizeLogo(await logoPng(width, height))).rejects.toMatchObject({ code: "BAD_DIMENSIONS" });
  });

  it("rejects bytes that are not an image", async () => {
    await expect(normalizeLogo(new Uint8Array([1, 2, 3, 4]))).rejects.toMatchObject({ code: "UNREADABLE" });
  });

  it("rejects an unsupported image format", async () => {
    const webp = new Uint8Array(await sharp({ create: { width: 200, height: 200, channels: 3, background: "#fff" } }).webp().toBuffer());
    await expect(normalizeLogo(webp)).rejects.toMatchObject({ code: "UNREADABLE" });
  });
});

describe("compositeLogo", () => {
  const slot = { x: 0.4, y: 0.04, width: 0.2, height: 0.12 };

  it("places the logo inside the slot, centered, and leaves the rest of the background untouched", async () => {
    const background = await solid(2480, 1754, "#ffffff", "jpeg");
    const logo = new Uint8Array(await sharp({ create: { width: 300, height: 300, channels: 3, background: "#000000" } }).png().toBuffer());
    const output = await compositeLogo(background, logo, slot, BACKGROUND_MAX_BYTES);

    expect(hasBackgroundSignature(output, "jpg")).toBe(true);
    const meta = await sharp(output).metadata();
    expect([meta.width, meta.height]).toEqual([2480, 1754]);

    const slotCenter = await sampleAverageColor(output, { x: 0.49, y: 0.09, width: 0.02, height: 0.02 });
    expect(slotCenter.r).toBeLessThan(30);
    const insideSlotOutsideLogo = await sampleAverageColor(output, { x: 0.401, y: 0.045, width: 0.01, height: 0.01 });
    expect(insideSlotOutsideLogo.r).toBeGreaterThan(240);
    const elsewhere = await sampleAverageColor(output, { x: 0.05, y: 0.5, width: 0.1, height: 0.1 });
    expect(elsewhere.r).toBeGreaterThan(240);
  });

  it("keeps the logo aspect ratio and fits it within the slot height", async () => {
    const background = await solid(2480, 1754, "#ffffff", "jpeg");
    const wide = new Uint8Array(await sharp({ create: { width: 1000, height: 200, channels: 3, background: "#000000" } }).png().toBuffer());
    const output = await compositeLogo(background, wide, slot, BACKGROUND_MAX_BYTES);
    const belowSlot = await sampleAverageColor(output, { x: 0.45, y: 0.17, width: 0.1, height: 0.02 });
    expect(belowSlot.r).toBeGreaterThan(240);
    const leftEdge = await sampleAverageColor(output, { x: 0.401, y: 0.095, width: 0.004, height: 0.004 });
    expect(leftEdge.r).toBeLessThan(30);
  });

  it("fails when the result cannot fit the byte limit", { timeout: NOISE_TIMEOUT_MS }, async () => {
    const noise = new Uint8Array(
      await sharp(seededNoise(1200 * 850 * 3, 1), { raw: { width: 1200, height: 850, channels: 3 } }).jpeg().toBuffer(),
    );
    const logo = new Uint8Array(await sharp({ create: { width: 100, height: 100, channels: 3, background: "#000" } }).png().toBuffer());
    await expect(compositeLogo(noise, logo, slot, 1000)).rejects.toMatchObject({ code: "TOO_LARGE" });
  });
});
