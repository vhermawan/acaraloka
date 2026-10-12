import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const providers = vi.hoisted(() => ({
  image: vi.fn(() => ({ id: "vertex", model: "img" })),
  text: vi.fn(() => ({ id: "vertex", model: "txt" })),
  client: { models: {} },
}));

vi.mock("@/server/ai/providers/vertex-image", () => ({ createVertexImageProvider: providers.image }));
vi.mock("@/server/ai/providers/vertex-text", () => ({ createVertexTextProvider: providers.text }));
vi.mock("@/server/ai/vertex-client", () => ({ getVertexClient: () => providers.client }));

describe("provider registry", () => {
  beforeEach(() => {
    vi.resetModules();
    providers.image.mockClear();
    providers.text.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("selects Vertex adapters with the configured models", async () => {
    vi.stubEnv("VERTEX_IMAGE_MODEL", "custom-image");
    vi.stubEnv("VERTEX_TEXT_MODEL", "custom-text");
    const { getImageProvider, getTextProvider } = await import("@/server/ai/config");
    getImageProvider();
    getTextProvider();
    expect(providers.image).toHaveBeenCalledWith(providers.client, "custom-image");
    expect(providers.text).toHaveBeenCalledWith(providers.client, "custom-text");
  });

  it("uses the default models when env is unset", async () => {
    const { getImageProvider, getTextProvider } = await import("@/server/ai/config");
    expect(getImageProvider()).toMatchObject({ id: "vertex" });
    expect(getTextProvider()).toMatchObject({ id: "vertex" });
    expect(providers.image).toHaveBeenCalledWith(providers.client, "gemini-nano-banana-2.1");
    expect(providers.text).toHaveBeenCalledWith(providers.client, "gemini-3.1-flash-lite");
  });

  it("rejects an unknown provider id at env load", async () => {
    vi.stubEnv("AI_IMAGE_PROVIDER", "openrouter");
    await expect(import("@/server/ai/config")).rejects.toThrow(/AI_IMAGE_PROVIDER/);
  });
});
