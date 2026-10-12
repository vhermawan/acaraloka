import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { aiDesignBriefSchema } from "@/lib/ai/design-brief";
import { presetBriefFor } from "@/lib/ai/style-presets";

const mocks = vi.hoisted(() => ({
  downloadObject: vi.fn(),
  uploadObject: vi.fn(),
  removeObjectsQuietly: vi.fn(),
  getOrCreate: vi.fn(),
  validate: vi.fn(),
  prune: vi.fn(),
  recordError: vi.fn(async () => undefined),
}));

vi.mock("@/server/db", () => ({ prisma: {} }));
vi.mock("@/server/storage", () => ({
  AI_BUCKET: "ai-generations",
  CERTIFICATE_BACKGROUND_BUCKET: "certificate-backgrounds",
  downloadObject: mocks.downloadObject,
  uploadObject: mocks.uploadObject,
}));
vi.mock("@/server/storage-cleanup", () => ({ removeObjectsQuietly: mocks.removeObjectsQuietly }));
vi.mock("@/server/error-log", () => ({ recordError: mocks.recordError }));
vi.mock("@/server/certificate-config", () => ({
  getOrCreateCertificateConfig: mocks.getOrCreate,
  validateBackgroundObject: mocks.validate,
  pruneToActiveBackground: mocks.prune,
}));

const { applyAiDesign } = await import("@/server/ai/apply-design");

const EVENT = "ev1";
const GEN = "gen1";
const LOGO = `events/${EVENT}/logo-0123456789abcdef.png`;
const brief = aiDesignBriefSchema.parse(presetBriefFor("minimal", null));

let image: Uint8Array;

type Setup = {
  generation?: unknown;
  config?: Record<string, unknown>;
  current?: Record<string, unknown>;
  updateCount?: number;
  usable?: number;
  txError?: Error;
};

function makeDb(setup: Setup = {}) {
  const config = { lockedAt: null, templateSource: "BUILTIN", backgroundPath: null, aiGenerationId: null, ...setup.config };
  mocks.getOrCreate.mockResolvedValue({ ...config, layout: {} });
  const tx = {
    aiGeneration: {
      updateMany: vi.fn(async () => ({ count: 1 })),
      count: vi.fn(async () => setup.usable ?? 1),
    },
    certificateConfig: {
      findUnique: vi.fn(async () => ({ layout: {}, ...config, ...setup.current })),
      updateMany: vi.fn(async () => ({ count: setup.updateCount ?? 1 })),
    },
    signer: { count: vi.fn(async () => 2) },
  };
  const db = {
    aiGeneration: {
      findFirst: vi.fn(async () =>
        "generation" in setup ? setup.generation : { brief, resultPaths: [`events/${EVENT}/cert-${GEN}.jpg`] },
      ),
    },
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => {
      if (setup.txError) throw setup.txError;
      return fn(tx);
    }),
  };
  return { db: db as never, tx, raw: db };
}

beforeEach(async () => {
  vi.clearAllMocks();
  image ??= new Uint8Array(await sharp({ create: { width: 2480, height: 1754, channels: 3, background: "#ffffff" } }).jpeg().toBuffer());
  mocks.downloadObject.mockResolvedValue(image);
  mocks.uploadObject.mockResolvedValue(undefined);
  mocks.validate.mockResolvedValue({ ok: true, format: "a4" });
  mocks.recordError.mockResolvedValue(undefined);
});

describe("applyAiDesign", () => {
  it("rejects a logo path of another event before touching anything", async () => {
    const { db, raw } = makeDb();
    const result = await applyAiDesign(EVENT, GEN, "events/other/logo-0123456789abcdef.png", {}, db);
    expect(result).toMatchObject({ ok: false, reason: "INVALID" });
    expect(raw.aiGeneration.findFirst).not.toHaveBeenCalled();
    expect(mocks.uploadObject).not.toHaveBeenCalled();
  });

  it("answers NOT_AVAILABLE when the generation is not usable", async () => {
    const { db } = makeDb({ generation: null });
    expect(await applyAiDesign(EVENT, GEN, null, {}, db)).toMatchObject({ ok: false, reason: "NOT_AVAILABLE" });
    expect(mocks.uploadObject).not.toHaveBeenCalled();
  });

  it("refuses a locked design early without copying anything", async () => {
    const { db } = makeDb({ config: { lockedAt: new Date() } });
    expect(await applyAiDesign(EVENT, GEN, null, {}, db)).toMatchObject({ ok: false, reason: "LOCKED" });
    expect(mocks.uploadObject).not.toHaveBeenCalled();
  });

  it("asks for confirmation before replacing another design", async () => {
    const { db } = makeDb({ config: { templateSource: "UPLOAD", backgroundPath: `events/${EVENT}/0123456789abcdef.jpg`, aiGenerationId: "other" } });
    expect(await applyAiDesign(EVENT, GEN, null, {}, db)).toMatchObject({ ok: false, reason: "NEEDS_CONFIRM" });
    expect(mocks.uploadObject).not.toHaveBeenCalled();
  });

  it("checks the confirmation again inside the transaction and removes the copy", async () => {
    const { db, tx } = makeDb({
      current: { templateSource: "UPLOAD", backgroundPath: `events/${EVENT}/0123456789abcdef.jpg`, aiGenerationId: "other" },
    });
    expect(await applyAiDesign(EVENT, GEN, null, {}, db)).toMatchObject({ ok: false, reason: "NEEDS_CONFIRM" });
    expect(tx.certificateConfig.updateMany).not.toHaveBeenCalled();
    expect(mocks.removeObjectsQuietly).toHaveBeenCalledTimes(1);
  });

  it("rolls back and removes the copied file when the lock lands during the transaction", async () => {
    const { db } = makeDb({ updateCount: 0 });
    expect(await applyAiDesign(EVENT, GEN, null, {}, db)).toMatchObject({ ok: false, reason: "LOCKED" });
    const target = mocks.uploadObject.mock.calls[0][1] as string;
    expect(mocks.removeObjectsQuietly).toHaveBeenCalledWith(expect.any(String), "certificate-backgrounds", [target]);
    expect(mocks.prune).not.toHaveBeenCalled();
  });

  it("removes the copied file when validation fails", async () => {
    mocks.validate.mockResolvedValue({ ok: false, error: "x", removable: true });
    const { db, raw } = makeDb();
    expect(await applyAiDesign(EVENT, GEN, null, {}, db)).toMatchObject({ ok: false, reason: "FAILED" });
    expect(raw.$transaction).not.toHaveBeenCalled();
    const target = mocks.uploadObject.mock.calls[0][1] as string;
    expect(mocks.removeObjectsQuietly).toHaveBeenCalledWith(expect.any(String), "certificate-backgrounds", [target]);
  });

  it("removes the copied file and logs when the transaction fails", async () => {
    const { db } = makeDb({ txError: new Error("db down") });
    expect(await applyAiDesign(EVENT, GEN, null, {}, db)).toMatchObject({ ok: false, reason: "FAILED" });
    expect(mocks.removeObjectsQuietly).toHaveBeenCalledTimes(1);
    expect(mocks.recordError).toHaveBeenCalledTimes(1);
    expect(mocks.prune).not.toHaveBeenCalled();
  });

  it("answers INVALID without logging an error when the logo object is gone", async () => {
    mocks.downloadObject.mockImplementation(async (_bucket: string, path: string) => {
      if (path === LOGO) throw new Error("missing");
      return image;
    });
    const { db } = makeDb();
    expect(await applyAiDesign(EVENT, GEN, LOGO, {}, db)).toMatchObject({ ok: false, reason: "INVALID" });
    expect(mocks.recordError).not.toHaveBeenCalled();
    expect(mocks.uploadObject).not.toHaveBeenCalled();
  });

  it("computes the layout for a different generation and writes the config", async () => {
    const { db, tx } = makeDb();
    expect(await applyAiDesign(EVENT, GEN, null, {}, db)).toEqual({ ok: true });
    const data = (tx.certificateConfig.updateMany.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data;
    expect(data).toMatchObject({ templateSource: "UPLOAD", aiGenerationId: GEN, pageHeight: 595.28 });
    expect(data.layout).toBeDefined();
    expect(tx.aiGeneration.updateMany).toHaveBeenCalled();
    expect(mocks.prune).toHaveBeenCalledWith(EVENT, db);
  });

  it("does not recompute the layout when the same generation is applied again", async () => {
    const { db, tx } = makeDb({
      config: { templateSource: "UPLOAD", backgroundPath: `events/${EVENT}/0123456789abcdef.jpg`, aiGenerationId: GEN },
    });
    expect(await applyAiDesign(EVENT, GEN, null, {}, db)).toEqual({ ok: true });
    const data = (tx.certificateConfig.updateMany.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data;
    expect(data).not.toHaveProperty("layout");
    expect(tx.signer.count).not.toHaveBeenCalled();
  });
});
