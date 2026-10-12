import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { aiDesignBriefSchema, type AiDesignBrief } from "@/lib/ai/design-brief";
import { presetBriefFor } from "@/lib/ai/style-presets";
import type { ImageResult } from "@/server/ai/types";

const mocks = vi.hoisted(() => ({ recordError: vi.fn(async () => undefined) }));

vi.mock("@/server/db", () => ({ prisma: {} }));
vi.mock("@/server/error-log", () => ({ recordError: mocks.recordError }));
vi.mock("@/server/storage", () => ({ AI_BUCKET: "ai-generations", uploadObject: vi.fn(), removeObjects: vi.fn() }));
vi.mock("@/server/ai/config", () => ({ getImageProvider: vi.fn(), getTextProvider: vi.fn() }));
vi.mock("@/lib/env", () => ({ getAiLimits: () => ({ deadlineMs: 60_000 }) }));

const { runGeneration, classifyImageFailure } = await import("@/server/ai/generation-job");
const { AiProviderError } = await import("@/server/ai/errors");

type Row = {
  id: string;
  eventId: string | null;
  status: string;
  input: unknown;
  startedAt: Date;
  event: { title: string } | null;
};

type Update = { where: { id: string; status?: string }; data: Record<string, unknown> };

function makeDb(row: Row) {
  const updates: Update[] = [];
  const db = {
    aiGeneration: {
      findUnique: vi.fn(async () => row),
      updateMany: vi.fn(async (args: Update) => {
        updates.push(args);
        if (args.where.status && args.where.status !== row.status) return { count: 0 };
        Object.assign(row, args.data);
        return { count: 1 };
      }),
    },
  };
  return { db, updates, row };
}

const llmBrief: AiDesignBrief = {
  palette: { primary: "#166534", secondary: "#ca8a04", background: "#f0fdf4", text: "#ffffff" },
  accent: "forest",
  fonts: { heading: "cinzel", name: "prata", body: "crimson" },
  layoutPreset: "centered-classic",
  motifs: ["leaf outlines"],
  visualDescription: "Delicate leaf outlines along the border with soft green gradient corners on a pale mint surface.",
};

async function png(width: number, height: number, color: string) {
  return new Uint8Array(await sharp({ create: { width, height, channels: 3, background: color } }).png().toBuffer());
}

async function setup(options: {
  input?: unknown;
  text?: () => Promise<{ json: unknown; costMicros: number }>;
  image?: () => Promise<ImageResult>;
  eventId?: string | null;
} = {}) {
  const row: Row = {
    id: "gen1",
    eventId: options.eventId === undefined ? "ev1" : options.eventId,
    status: "RUNNING",
    input: options.input ?? { style: "formal-campus", colorHex: null, note: "" },
    startedAt: new Date(1_000_000),
    event: { title: "Seminar Kesehatan" },
  };
  const fake = makeDb(row);
  const uploads: { path: string; size: number; contentType: string }[] = [];
  const removed: string[][] = [];
  const imageGenerate = vi.fn(
    options.image ??
      (async () => ({ bytes: await png(2528, 1696, "#ffffff"), mime: "image/png", width: 2528, height: 1696, costMicros: 50_000 })),
  );
  const generateJson = vi.fn<(request: { user: string }) => Promise<{ json: unknown; costMicros: number }>>(
    options.text ?? (async () => ({ json: llmBrief, costMicros: 1_000 })),
  );
  const deps = {
    db: fake.db as never,
    textProvider: () => ({ id: "vertex", model: "text-model", generateJson }),
    imageProvider: () => ({ id: "vertex", model: "image-model", supports: () => true, generate: imageGenerate }),
    upload: async (path: string, body: Uint8Array, contentType: string) => {
      uploads.push({ path, size: body.byteLength, contentType });
    },
    remove: async (paths: string[]) => {
      removed.push(paths);
    },
    now: () => 1_000_000 + 5_000,
    deadlineMs: 60_000,
  };
  return { ...fake, uploads, removed, imageGenerate, generateJson, deps };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runGeneration success", () => {
  it("walks BRIEF, IMAGE and FINALIZE, stores two files and finishes with SUCCEEDED and the usage cost", async () => {
    const { deps, row, updates, uploads } = await setup();
    await runGeneration("gen1", deps);

    expect(updates.filter((update) => update.data.phase).map((update) => update.data.phase)).toEqual([
      "BRIEF",
      "IMAGE",
      "FINALIZE",
    ]);
    expect(row.status).toBe("SUCCEEDED");
    expect(uploads.map((upload) => upload.path)).toEqual(["events/ev1/cert-gen1.jpg", "events/ev1/cert-gen1-thumb.jpg"]);
    expect(uploads.every((upload) => upload.contentType === "image/jpeg")).toBe(true);
    expect(uploads[1].size).toBeLessThan(uploads[0].size);
    const done = updates.at(-1)!.data;
    expect(done).toMatchObject({
      status: "SUCCEEDED",
      briefSource: "LLM",
      provider: "vertex",
      model: "image-model",
      costMicros: 51_000,
      resultPaths: ["events/ev1/cert-gen1.jpg", "events/ev1/cert-gen1-thumb.jpg"],
      width: 2480,
      height: 1754,
    });
  });

  it("makes every state change conditional on the row still being RUNNING", async () => {
    const { deps, updates } = await setup();
    await runGeneration("gen1", deps);
    expect(updates.length).toBeGreaterThanOrEqual(4);
    for (const update of updates) expect(update.where).toMatchObject({ id: "gen1", status: "RUNNING" });
  });

  it("stores the brief with text color adjusted to the sampled background contrast", async () => {
    const { deps, updates } = await setup();
    await runGeneration("gen1", deps);
    const brief = aiDesignBriefSchema.parse(updates.at(-1)!.data.brief);
    expect(llmBrief.palette.text).toBe("#ffffff");
    expect(brief.palette.text).toBe("#1c1c1f");
  });

  it("keeps a readable text color from the brief", async () => {
    const dark = { ...llmBrief, palette: { ...llmBrief.palette, text: "#14532d" } };
    const { deps, updates } = await setup({ text: async () => ({ json: dark, costMicros: 0 }) });
    await runGeneration("gen1", deps);
    expect(aiDesignBriefSchema.parse(updates.at(-1)!.data.brief).palette.text).toBe("#14532d");
  });

  it("falls back to the style preset when the brief call fails and still succeeds", async () => {
    const { deps, updates } = await setup({
      text: async () => {
        throw new AiProviderError("boom", "RETRYABLE", 503);
      },
    });
    await runGeneration("gen1", deps);
    const done = updates.at(-1)!.data;
    expect(done).toMatchObject({ status: "SUCCEEDED", briefSource: "PRESET", costMicros: 50_000 });
    expect(aiDesignBriefSchema.parse(done.brief).layoutPreset).toBe(presetBriefFor("formal-campus", null).layoutPreset);
  });

  it("falls back to the preset when the text provider cannot be created", async () => {
    const { deps, updates } = await setup();
    await runGeneration("gen1", {
      ...deps,
      textProvider: () => {
        throw new AiProviderError("no credentials", "CONFIG");
      },
    });
    expect(updates.at(-1)!.data).toMatchObject({ status: "SUCCEEDED", briefSource: "PRESET" });
  });

  it("sends the event title, style, color and note to the brief provider and never a logo", async () => {
    const { deps, generateJson } = await setup({ input: { style: "cheerful", colorHex: "#16a34a", note: "nuansa daun" } });
    await runGeneration("gen1", deps);
    const call = generateJson.mock.calls[0][0];
    expect(JSON.parse(call.user)).toMatchObject({
      event_title: "Seminar Kesehatan",
      style: "cheerful",
      primary_color: "#16a34a",
      has_logo: false,
    });
    expect(call.user).toContain("nuansa daun");
  });

  it("retries a retryable image failure once and records the attempt that worked", async () => {
    let calls = 0;
    const { deps, updates, imageGenerate } = await setup({
      image: async () => {
        calls += 1;
        if (calls === 1) throw new AiProviderError("unavailable", "RETRYABLE", 503);
        return { bytes: await png(2528, 1696, "#ffffff"), mime: "image/png", width: 2528, height: 1696, costMicros: 50_000 };
      },
    });
    await runGeneration("gen1", deps);
    expect(imageGenerate).toHaveBeenCalledTimes(2);
    expect(updates.at(-1)!.data.status).toBe("SUCCEEDED");
  });
});

describe("runGeneration failures", () => {
  const failing = (error: unknown) => async () => {
    throw error;
  };

  it("rejects a safety block when the organizer wrote a note, without recording an error", async () => {
    const { deps, row } = await setup({
      input: { style: "minimal", colorHex: null, note: "seminar kesehatan" },
      image: failing(new AiProviderError("blocked", "SAFETY", 400)),
    });
    await runGeneration("gen1", deps);
    expect(row).toMatchObject({ status: "REJECTED", failureCode: "VENDOR_SAFETY", costMicros: 1_000 });
    expect(mocks.recordError).not.toHaveBeenCalled();
  });

  it("treats a safety block without a note as a technical failure and records it", async () => {
    const { deps, row } = await setup({ image: failing(new AiProviderError("blocked", "SAFETY", 400)) });
    await runGeneration("gen1", deps);
    expect(row).toMatchObject({ status: "FAILED", failureCode: "VENDOR_SAFETY" });
    expect(mocks.recordError).toHaveBeenCalledWith(expect.objectContaining({ source: "ai.generation.image", level: "warn" }));
  });

  it("fails with VENDOR_CONFIG and records an error level entry for a configuration problem", async () => {
    const { deps, row } = await setup({ image: failing(new AiProviderError("403 forbidden", "CONFIG", 403)) });
    await runGeneration("gen1", deps);
    expect(row).toMatchObject({ status: "FAILED", failureCode: "VENDOR_CONFIG" });
    expect(mocks.recordError).toHaveBeenCalledWith(expect.objectContaining({ level: "error" }));
  });

  it("fails with VENDOR_CAPACITY when the vendor keeps answering 429", async () => {
    const { deps, row } = await setup({ image: failing(new AiProviderError("exhausted", "RETRYABLE", 429)) });
    await runGeneration("gen1", { ...deps, now: () => 1_000_000 + 58_000 });
    expect(row).toMatchObject({ status: "FAILED", failureCode: "VENDOR_CAPACITY" });
  });

  it("fails with TIMEOUT when the deadline is already over", async () => {
    const { deps, row, imageGenerate } = await setup();
    await runGeneration("gen1", { ...deps, now: () => 1_000_000 + 61_000 });
    expect(imageGenerate).not.toHaveBeenCalled();
    expect(row).toMatchObject({ status: "FAILED", failureCode: "TIMEOUT" });
  });

  it("fails with INVALID_OUTPUT when the vendor image cannot be normalized", async () => {
    const { deps, row, uploads } = await setup({
      image: async () => ({ bytes: new Uint8Array([1, 2, 3]), mime: "image/png", width: 10, height: 10, costMicros: 50_000 }),
    });
    await runGeneration("gen1", deps);
    expect(row).toMatchObject({ status: "FAILED", failureCode: "INVALID_OUTPUT", costMicros: 51_000 });
    expect(uploads).toHaveLength(0);
  });

  it("fails with INTERNAL_ERROR, removes uploaded files and records an error when storage breaks", async () => {
    const { deps, row, removed } = await setup();
    let calls = 0;
    await runGeneration("gen1", {
      ...deps,
      upload: async () => {
        calls += 1;
        if (calls === 2) throw new Error("storage down");
      },
    });
    expect(row).toMatchObject({ status: "FAILED", failureCode: "INTERNAL_ERROR" });
    expect(removed).toEqual([["events/ev1/cert-gen1.jpg"]]);
    expect(mocks.recordError).toHaveBeenCalledWith(expect.objectContaining({ source: "ai.generation.job", level: "error" }));
  });

  it("never exposes vendor wording in the stored failure", async () => {
    const { deps, row } = await setup({ image: failing(new AiProviderError("projects/secret-proj billing disabled", "CONFIG", 403)) });
    await runGeneration("gen1", deps);
    expect(JSON.stringify(row)).not.toMatch(/secret-proj|billing/);
  });

  it("does not overwrite a row that was swept as STALE while it ran, and removes the files", async () => {
    const { deps, row, removed } = await setup();
    await runGeneration("gen1", {
      ...deps,
      upload: async (path) => {
        if (path.endsWith("-thumb.jpg")) row.status = "FAILED";
      },
    });
    expect(row.status).toBe("FAILED");
    expect(row).not.toHaveProperty("resultPaths");
    expect(removed).toEqual([["events/ev1/cert-gen1.jpg", "events/ev1/cert-gen1-thumb.jpg"]]);
  });

  it("stops before storing anything when the row was swept while the image was being made", async () => {
    const { deps, row, uploads } = await setup({
      image: async () => {
        row.status = "FAILED";
        return { bytes: await png(2528, 1696, "#ffffff"), mime: "image/png", width: 2528, height: 1696, costMicros: 50_000 };
      },
    });
    await runGeneration("gen1", deps);
    expect(row.status).toBe("FAILED");
    expect(uploads).toHaveLength(0);
  });

  it("stops without calling a vendor when the row was already swept before the job started", async () => {
    const { deps, row, imageGenerate, generateJson } = await setup();
    row.status = "FAILED";
    await runGeneration("gen1", deps);
    expect(imageGenerate).not.toHaveBeenCalled();
    expect(generateJson).not.toHaveBeenCalled();
  });

  it("marks the row FAILED and records an error when loading the row throws", async () => {
    const { deps, db, updates } = await setup();
    db.aiGeneration.findUnique.mockRejectedValueOnce(new Error("db down"));
    await expect(runGeneration("gen1", deps)).resolves.toBeUndefined();
    expect(updates.at(-1)).toMatchObject({ where: { id: "gen1", status: "RUNNING" }, data: { status: "FAILED", failureCode: "INTERNAL_ERROR" } });
    expect(mocks.recordError).toHaveBeenCalledWith(expect.objectContaining({ source: "ai.generation.job", level: "error" }));
  });

  it("never rejects even when the failure bookkeeping also fails", async () => {
    const { deps, db } = await setup({ input: { bogus: true } });
    db.aiGeneration.updateMany.mockRejectedValue(new Error("db down"));
    mocks.recordError.mockRejectedValueOnce(new Error("log down"));
    await expect(runGeneration("gen1", deps)).resolves.toBeUndefined();
  });

  it("does nothing for an unknown generation or one without an event", async () => {
    const { deps, imageGenerate } = await setup({ eventId: null });
    await runGeneration("gen1", deps);
    expect(imageGenerate).not.toHaveBeenCalled();
  });
});

describe("classifyImageFailure", () => {
  it("maps provider errors to status and code", () => {
    expect(classifyImageFailure(new AiProviderError("x", "RETRYABLE", 500), false)).toMatchObject({ status: "FAILED", code: "VENDOR_ERROR" });
    expect(classifyImageFailure(new AiProviderError("x", "RETRYABLE", 429), false)).toMatchObject({ code: "VENDOR_CAPACITY", record: null });
    expect(classifyImageFailure(new AiProviderError("Generation deadline reached", "RETRYABLE"), false)).toMatchObject({ code: "TIMEOUT" });
    expect(classifyImageFailure(new AiProviderError("x", "SAFETY", 400), true)).toMatchObject({ status: "REJECTED", code: "VENDOR_SAFETY" });
    expect(classifyImageFailure(new AiProviderError("x", "CONFIG", 401), false)).toMatchObject({ code: "VENDOR_CONFIG", record: "error" });
  });
});
