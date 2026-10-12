import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const constructed = vi.hoisted(() => vi.fn());

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: vi.fn() };
    constructor(options: unknown) {
      constructed(options);
    }
  },
}));

function encode(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64");
}

const account = { client_email: "svc@example.iam.gserviceaccount.com", private_key: "fake-key", project_id: "fake-project" };

describe("parseServiceAccount", () => {
  it("decodes a base64 service account", async () => {
    const { parseServiceAccount } = await import("@/server/ai/vertex-client");
    expect(parseServiceAccount(encode(account))).toEqual(account);
  });

  it.each([
    ["undefined", undefined],
    ["not base64 JSON", "%%%"],
    ["missing fields", encode({ client_email: "x" })],
  ])("throws a CONFIG error without leaking the value for %s", async (_name, value) => {
    const { parseServiceAccount } = await import("@/server/ai/vertex-client");
    expect(() => parseServiceAccount(value)).toThrowError(expect.objectContaining({ kind: "CONFIG" }));
    try {
      parseServiceAccount(value);
    } catch (error) {
      expect(String((error as Error).message)).not.toContain(String(value ?? "undefined-marker"));
    }
  });
});

describe("getVertexClient", () => {
  beforeEach(() => {
    vi.resetModules();
    constructed.mockClear();
    vi.stubEnv("GOOGLE_VERTEX_SA_KEY_B64", encode(account));
    vi.stubEnv("GOOGLE_VERTEX_PROJECT", "");
    vi.stubEnv("GOOGLE_VERTEX_LOCATION", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds a Vertex client from env once per instance and falls back to the key's project", async () => {
    const { getVertexClient } = await import("@/server/ai/vertex-client");
    const first = getVertexClient();
    expect(getVertexClient()).toBe(first);
    expect(constructed).toHaveBeenCalledTimes(1);
    expect(constructed).toHaveBeenCalledWith({
      vertexai: true,
      project: "fake-project",
      location: "global",
      googleAuthOptions: { credentials: { client_email: account.client_email, private_key: account.private_key } },
    });
  });

  it("prefers GOOGLE_VERTEX_PROJECT and the configured location", async () => {
    vi.stubEnv("GOOGLE_VERTEX_PROJECT", "env-project");
    vi.stubEnv("GOOGLE_VERTEX_LOCATION", "us");
    const { getVertexClient } = await import("@/server/ai/vertex-client");
    getVertexClient();
    expect(constructed).toHaveBeenCalledWith(expect.objectContaining({ project: "env-project", location: "us" }));
  });

  it("fails with a CONFIG error when the key is missing", async () => {
    vi.stubEnv("GOOGLE_VERTEX_SA_KEY_B64", "");
    const { getVertexClient } = await import("@/server/ai/vertex-client");
    expect(() => getVertexClient()).toThrowError(expect.objectContaining({ kind: "CONFIG" }));
  });
});
