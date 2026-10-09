import { describe, expect, it } from "vitest";

import {
  BACKGROUND_MAX_BYTES,
  backgroundFormat,
  detectPageFormat,
  pageSizeFor,
  validateBackgroundDimensions,
  validateBackgroundFile,
} from "@/lib/certificate-background";

describe("detectPageFormat", () => {
  it("accepts A4 landscape and 16:9 within 2 percent", () => {
    expect(detectPageFormat(2480, 1754)).toBe("a4");
    expect(detectPageFormat(1754, 1240)).toBe("a4");
    expect(detectPageFormat(1920, 1080)).toBe("wide");
    expect(detectPageFormat(1920, 1090)).toBe("wide");
  });

  it("rejects other ratios and invalid sizes", () => {
    expect(detectPageFormat(1000, 1000)).toBeNull();
    expect(detectPageFormat(1754, 2480)).toBeNull();
    expect(detectPageFormat(1920, 1200)).toBeNull();
    expect(detectPageFormat(1920, 1000)).toBeNull();
    expect(detectPageFormat(0, 100)).toBeNull();
  });
});

describe("validateBackgroundDimensions", () => {
  it("returns the format for acceptable images", () => {
    expect(validateBackgroundDimensions(2480, 1754)).toEqual({ ok: true, format: "a4" });
    expect(validateBackgroundDimensions(1920, 1080)).toEqual({ ok: true, format: "wide" });
  });

  it("explains the suggested sizes when the ratio is wrong", () => {
    const result = validateBackgroundDimensions(1000, 1000);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("2480×1754");
  });

  it("rejects images below the minimum resolution", () => {
    const result = validateBackgroundDimensions(1200, 849);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Resolusi");
  });
});

describe("validateBackgroundFile", () => {
  it("accepts PNG and JPEG under 3 MB", () => {
    expect(validateBackgroundFile("image/png", 1000)).toBeNull();
    expect(validateBackgroundFile("image/jpeg", BACKGROUND_MAX_BYTES)).toBeNull();
  });

  it("rejects WebP, PDF, and oversized files", () => {
    expect(validateBackgroundFile("image/webp", 1000)).not.toBeNull();
    expect(validateBackgroundFile("application/pdf", 1000)).not.toBeNull();
    expect(validateBackgroundFile("image/png", BACKGROUND_MAX_BYTES + 1)).not.toBeNull();
    expect(validateBackgroundFile("image/png", 0)).not.toBeNull();
  });
});

describe("page sizes", () => {
  it("maps formats to PDF points", () => {
    expect(pageSizeFor("a4")).toEqual({ width: 841.89, height: 595.28 });
    expect(pageSizeFor("wide")).toEqual({ width: 841.89, height: 473.56 });
  });

  it("reads the stored format from the path", () => {
    expect(backgroundFormat("events/e/a.png")).toBe("png");
    expect(backgroundFormat("events/e/a.jpg")).toBe("jpg");
  });
});
