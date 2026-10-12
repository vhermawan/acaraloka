import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSignedUrls: vi.fn(),
  reportCleanupFailure: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/server/storage", () => ({ AI_BUCKET: "ai-generations", createSignedUrls: mocks.createSignedUrls }));
vi.mock("@/server/storage-cleanup", () => ({ reportCleanupFailure: mocks.reportCleanupFailure }));
vi.mock("@/server/db", () => ({ prisma: {} }));
vi.mock("@/server/ai-quota", () => ({ countGlobalToday: vi.fn(), isCapReached: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: { AI_ENABLED: false }, getAiLimits: vi.fn() }));

const { listRecentAiGenerations } = await import("@/server/admin-ai");

const db = { aiGeneration: { findMany: mocks.findMany } } as never;

function row(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    eventId: "ev1",
    kind: "CERTIFICATE",
    status: "SUCCEEDED",
    failureCode: null,
    costMicros: 1000,
    firstUsedAt: null,
    reportedAt: null,
    purgedAt: null,
    createdAt: new Date("2026-10-01T00:00:00Z"),
    event: { title: "Acara" },
    user: { name: "Nama", email: "a@b.test" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listRecentAiGenerations", () => {
  it("selects only summary columns and limits to 50", async () => {
    mocks.findMany.mockResolvedValue([]);
    await listRecentAiGenerations(db);
    const args = mocks.findMany.mock.calls[0][0];
    expect(args.take).toBe(50);
    expect(args.select).not.toHaveProperty("input");
    expect(args.select).not.toHaveProperty("brief");
    expect(args.select).not.toHaveProperty("resultPaths");
  });

  it("signs thumbnails only for succeeded, non-purged rows", async () => {
    mocks.findMany.mockResolvedValue([
      row("ok"),
      row("failed", { status: "FAILED" }),
      row("purged", { purgedAt: new Date() }),
      row("noevent", { eventId: null }),
    ]);
    mocks.createSignedUrls.mockResolvedValue(new Map([["events/ev1/cert-ok-thumb.jpg", "https://signed/ok"]]));

    const result = await listRecentAiGenerations(db);

    expect(mocks.createSignedUrls).toHaveBeenCalledTimes(1);
    expect(mocks.createSignedUrls.mock.calls[0][1]).toEqual(["events/ev1/cert-ok-thumb.jpg"]);
    expect(result.thumbsFailed).toBe(false);
    expect(result.rows.map((item) => item.thumbUrl)).toEqual(["https://signed/ok", null, null, null]);
  });

  it("does not call the batch when nothing needs a thumbnail", async () => {
    mocks.findMany.mockResolvedValue([row("failed", { status: "FAILED" })]);
    const result = await listRecentAiGenerations(db);
    expect(mocks.createSignedUrls).not.toHaveBeenCalled();
    expect(result.thumbsFailed).toBe(false);
  });

  it("returns null thumbnails, flags the failure and reports it when signing fails", async () => {
    mocks.findMany.mockResolvedValue([row("ok")]);
    mocks.createSignedUrls.mockRejectedValue(new Error("boom"));
    const result = await listRecentAiGenerations(db);
    expect(result.thumbsFailed).toBe(true);
    expect(result.rows[0].thumbUrl).toBeNull();
    expect(mocks.reportCleanupFailure).toHaveBeenCalledWith("admin.ai.thumbs", expect.any(Error), { bucket: "ai-generations" });
  });
});
