import { describe, expect, it } from "vitest";

import { decodeSignaturePng } from "@/server/signature-image";

const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

describe("decodeSignaturePng", () => {
  it("accepts a PNG data URL", () => {
    expect(decodeSignaturePng(`data:image/png;base64,${PNG}`)?.[1]).toBe(0x50);
  });

  it.each([
    undefined,
    "",
    `data:image/jpeg;base64,${PNG}`,
    `data:image/png;base64,${Buffer.from("not a png at all, just some text that is long enough to pass the size check....").toString("base64")}`,
    `data:image/png;base64,${"A".repeat(500_000)}`,
  ])("rejects %#", (value) => {
    expect(decodeSignaturePng(value)).toBeNull();
  });
});
