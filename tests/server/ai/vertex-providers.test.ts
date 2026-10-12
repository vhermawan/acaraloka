import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import { presetBriefFor } from "@/lib/ai/style-presets";
import { createVertexImageProvider } from "@/server/ai/providers/vertex-image";
import { createVertexTextProvider } from "@/server/ai/providers/vertex-text";
import type { ImageRequest } from "@/server/ai/types";
import type { VertexClient } from "@/server/ai/vertex-client";

function clientReturning(...responses: unknown[]) {
  const generateContent = vi.fn();
  for (const response of responses) {
    if (response instanceof Error) generateContent.mockRejectedValueOnce(response);
    else generateContent.mockResolvedValueOnce(response);
  }
  return { client: { models: { generateContent } } as unknown as VertexClient, generateContent };
}

async function pngBase64(width: number, height: number) {
  const bytes = await sharp({ create: { width, height, channels: 3, background: "#224488" } }).png().toBuffer();
  return bytes.toString("base64");
}

const request: ImageRequest = {
  kind: "CERTIFICATE",
  aspect: "A4_LANDSCAPE",
  minWidth: 1754,
  spec: { style: "formal-campus", brief: presetBriefFor("formal-campus", null) },
};
const context = () => ({ signal: new AbortController().signal });

async function imageResponse(extra: Record<string, unknown> = {}) {
  return {
    candidates: [{ content: { parts: [{ inlineData: { data: await pngBase64(60, 40), mimeType: "image/png" } }] } }],
    usageMetadata: {
      promptTokenCount: 400,
      candidatesTokenCount: 1700,
      candidatesTokensDetails: [{ modality: "IMAGE", tokenCount: 1680 }],
    },
    ...extra,
  };
}

describe("createVertexImageProvider", () => {
  it("requests a 2K 3:2 image and returns bytes, size and token-based cost", async () => {
    const { client, generateContent } = clientReturning(await imageResponse());
    const provider = createVertexImageProvider(client, "image-model");
    const result = await provider.generate(request, context());

    expect(result).toMatchObject({ mime: "image/png", width: 60, height: 40 });
    expect(result.bytes.byteLength).toBeGreaterThan(0);
    expect(result.costMicros).toBe(Math.round((400 * 500_000) / 1e6) + Math.round((1680 * 30_000_000) / 1e6));

    const call = generateContent.mock.calls[0]?.[0];
    expect(call.model).toBe("image-model");
    expect(call.config.responseModalities).toEqual(["IMAGE"]);
    expect(call.config.imageConfig).toEqual({ aspectRatio: "3:2", imageSize: "2K" });
    expect(call.config.abortSignal).toBeInstanceOf(AbortSignal);
    expect(call.contents).toContain("Do NOT draw any text");
  });

  it("uses the flat price when the response has no usage metadata", async () => {
    const { client } = clientReturning(await imageResponse({ usageMetadata: undefined }));
    const result = await createVertexImageProvider(client, "m").generate(request, context());
    expect(result.costMicros).toBe(50_000);
  });

  it("maps a prompt block to SAFETY", async () => {
    const { client } = clientReturning({ promptFeedback: { blockReason: "PROHIBITED_CONTENT" }, candidates: [] });
    await expect(createVertexImageProvider(client, "m").generate(request, context())).rejects.toMatchObject({ kind: "SAFETY" });
  });

  it.each([
    ["IMAGE_SAFETY", "SAFETY"],
    ["STOP", "RETRYABLE"],
  ])("maps a missing image with finishReason %s to %s", async (finishReason, kind) => {
    const { client } = clientReturning({ candidates: [{ finishReason, content: { parts: [{ text: "sorry" }] } }] });
    await expect(createVertexImageProvider(client, "m").generate(request, context())).rejects.toMatchObject({ kind });
  });

  it("treats undecodable image data as RETRYABLE", async () => {
    const { client } = clientReturning({
      candidates: [{ content: { parts: [{ inlineData: { data: Buffer.from("not an image").toString("base64") } }] } }],
    });
    await expect(createVertexImageProvider(client, "m").generate(request, context())).rejects.toMatchObject({
      kind: "RETRYABLE",
    });
  });

  it.each([
    [Object.assign(new Error("quota"), { status: 429 }), "RETRYABLE", 429],
    [Object.assign(new Error("denied"), { status: 403 }), "CONFIG", 403],
  ])("classifies SDK errors", async (error, kind, status) => {
    const { client } = clientReturning(error);
    await expect(createVertexImageProvider(client, "m").generate(request, context())).rejects.toMatchObject({ kind, status });
  });

  it("only supports certificate A4 landscape within the model resolution", () => {
    const provider = createVertexImageProvider(clientReturning().client, "m");
    expect(provider.supports(request)).toBe(true);
    expect(provider.supports({ ...request, kind: "POSTER" })).toBe(false);
    expect(provider.supports({ ...request, aspect: "4:5" })).toBe(false);
    expect(provider.supports({ ...request, minWidth: 4000 })).toBe(false);
  });
});

describe("createVertexTextProvider", () => {
  const input = { system: "sys", user: "usr", jsonSchema: { type: "object" } };

  it("requests structured JSON and returns parsed output with cost", async () => {
    const { client, generateContent } = clientReturning({
      text: '{"a":1}',
      usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 200, thoughtsTokenCount: 100 },
    });
    const result = await createVertexTextProvider(client, "text-model").generateJson(input, context());

    expect(result.json).toEqual({ a: 1 });
    expect(result.costMicros).toBe(Math.round((1000 * 250_000) / 1e6) + Math.round((300 * 1_500_000) / 1e6));
    const call = generateContent.mock.calls[0]?.[0];
    expect(call).toMatchObject({
      model: "text-model",
      contents: "usr",
      config: { systemInstruction: "sys", responseMimeType: "application/json", responseJsonSchema: { type: "object" } },
    });
  });

  it.each([
    [{ text: "" }, "RETRYABLE"],
    [{ text: "not json" }, "RETRYABLE"],
    [{ promptFeedback: { blockReason: "SAFETY" } }, "SAFETY"],
  ])("classifies bad responses %j as %s", async (response, kind) => {
    const { client } = clientReturning(response);
    await expect(createVertexTextProvider(client, "m").generateJson(input, context())).rejects.toMatchObject({ kind });
  });

  it("classifies SDK failures", async () => {
    const { client } = clientReturning(Object.assign(new Error("unavailable"), { status: 503 }));
    await expect(createVertexTextProvider(client, "m").generateJson(input, context())).rejects.toMatchObject({
      kind: "RETRYABLE",
      status: 503,
    });
  });
});
