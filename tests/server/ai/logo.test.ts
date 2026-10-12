import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import { LOGO_INVALID_MESSAGE, LOGO_MAX_BYTES } from "@/lib/ai/generate-input";

vi.mock("@/server/storage", () => ({ AI_BUCKET: "ai-generations", downloadObject: vi.fn(), uploadObject: vi.fn() }));
vi.mock("@/server/storage-cleanup", () => ({ removeObjectsQuietly: vi.fn() }));

const { finalizeLogoUpload } = await import("@/server/ai/logo");

const RAW = "events/ev1/upload-0123456789abcdef.png";

function setup(bytes: Uint8Array | Error) {
  const uploads: { path: string; contentType: string; body: Uint8Array }[] = [];
  const removed: string[] = [];
  const deps = {
    download: async () => {
      if (bytes instanceof Error) throw bytes;
      return bytes;
    },
    upload: async (path: string, body: Uint8Array, contentType: string) => {
      uploads.push({ path, contentType, body });
    },
    removeRaw: async (path: string) => {
      removed.push(path);
    },
    newId: () => "fedcba9876543210",
  };
  return { deps, uploads, removed };
}

const png = async (width = 300, height = 200) =>
  new Uint8Array(await sharp({ create: { width, height, channels: 4, background: "#ff000080" } }).png().toBuffer());

describe("finalizeLogoUpload", () => {
  it("stores a normalized PNG under the logo path and removes the raw upload", async () => {
    const { deps, uploads, removed } = setup(await png());
    const result = await finalizeLogoUpload("ev1", RAW, deps);
    expect(result).toEqual({ ok: true, path: "events/ev1/logo-fedcba9876543210.png" });
    expect(uploads).toHaveLength(1);
    expect(uploads[0]).toMatchObject({ path: "events/ev1/logo-fedcba9876543210.png", contentType: "image/png" });
    expect((await sharp(uploads[0].body).metadata()).format).toBe("png");
    expect(removed).toEqual([RAW]);
  });

  it("accepts a JPEG upload", async () => {
    const jpeg = new Uint8Array(await sharp({ create: { width: 200, height: 200, channels: 3, background: "#00f" } }).jpeg().toBuffer());
    const { deps, uploads } = setup(jpeg);
    const result = await finalizeLogoUpload("ev1", "events/ev1/upload-0123456789abcdef.jpg", deps);
    expect(result.ok).toBe(true);
    expect(uploads).toHaveLength(1);
  });

  it("refuses a raw path that belongs to another event without touching storage", async () => {
    const { deps, uploads, removed } = setup(await png());
    const result = await finalizeLogoUpload("ev2", RAW, deps);
    expect(result).toEqual({ ok: false, error: LOGO_INVALID_MESSAGE });
    expect(uploads).toHaveLength(0);
    expect(removed).toHaveLength(0);
  });

  it("refuses a path that is not a raw upload path", async () => {
    const { deps } = setup(await png());
    expect(await finalizeLogoUpload("ev1", "events/ev1/logo-0123456789abcdef.png", deps)).toEqual({
      ok: false,
      error: LOGO_INVALID_MESSAGE,
    });
  });

  it("refuses a file larger than 2 MB and still removes it", async () => {
    const big = new Uint8Array(LOGO_MAX_BYTES + 1);
    big.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const { deps, uploads, removed } = setup(big);
    expect(await finalizeLogoUpload("ev1", RAW, deps)).toEqual({ ok: false, error: LOGO_INVALID_MESSAGE });
    expect(uploads).toHaveLength(0);
    expect(removed).toEqual([RAW]);
  });

  it("refuses bytes without a PNG or JPEG signature even when named .png", async () => {
    const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0]);
    const { deps, uploads, removed } = setup(gif);
    expect(await finalizeLogoUpload("ev1", RAW, deps)).toEqual({ ok: false, error: LOGO_INVALID_MESSAGE });
    expect(uploads).toHaveLength(0);
    expect(removed).toEqual([RAW]);
  });

  it("reports a missing upload", async () => {
    const { deps } = setup(new Error("404"));
    const result = await finalizeLogoUpload("ev1", RAW, deps);
    expect(result).toMatchObject({ ok: false });
    expect((result as { error: string }).error).toMatch(/belum terunggah/);
  });

  it("refuses a logo with dimensions out of range and removes the raw file", async () => {
    const { deps, uploads, removed } = setup(await png(32, 32));
    const result = await finalizeLogoUpload("ev1", RAW, deps);
    expect(result).toEqual({ ok: false, error: "Ukuran logo harus antara 64 dan 4096 piksel." });
    expect(uploads).toHaveLength(0);
    expect(removed).toEqual([RAW]);
  });

  it("refuses a truncated image", async () => {
    const full = await png();
    const { deps, uploads } = setup(full.slice(0, 40));
    const result = await finalizeLogoUpload("ev1", RAW, deps);
    expect(result.ok).toBe(false);
    expect(uploads).toHaveLength(0);
  });
});
