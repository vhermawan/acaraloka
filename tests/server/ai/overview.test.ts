import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAiAccess: vi.fn(),
  sweep: vi.fn(),
  countEventKind: vi.fn(),
  countAccountToday: vi.fn(),
  listObjects: vi.fn(),
  createSignedUrls: vi.fn(),
}));

vi.mock("@/server/db", () => ({ prisma: {} }));
vi.mock("@/server/ai-access", () => ({ getAiAccess: mocks.getAiAccess }));
vi.mock("@/server/ai-quota", () => ({
  sweepStaleGenerations: mocks.sweep,
  countEventKind: mocks.countEventKind,
  countAccountToday: mocks.countAccountToday,
}));
vi.mock("@/server/storage", () => ({
  AI_BUCKET: "ai-generations",
  listObjects: mocks.listObjects,
  createSignedUrls: mocks.createSignedUrls,
}));
vi.mock("@/server/storage-cleanup", () => ({ reportCleanupFailure: vi.fn() }));

const { loadAiOverview } = await import("@/server/ai/overview");

const now = new Date("2026-10-12T10:00:00Z");
const user = { id: "user1" };
const event = { id: "ev1" };

function makeDb(options: { running?: unknown; latest?: unknown; successes?: unknown[]; config?: unknown; reported?: number }) {
  return {
    aiGeneration: {
      findFirst: vi.fn(async (args: { where: { status?: string } }) =>
        args.where.status === "RUNNING" ? (options.running ?? null) : (options.latest ?? null),
      ),
      findMany: vi.fn(async () => options.successes ?? []),
      count: vi.fn(async () => options.reported ?? 0),
    },
    certificateConfig: { findUnique: vi.fn(async () => options.config ?? null) },
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAiAccess.mockResolvedValue({ status: "AVAILABLE", remaining: 2 });
  mocks.countEventKind.mockResolvedValue(1);
  mocks.countAccountToday.mockResolvedValue(4);
  mocks.listObjects.mockResolvedValue([]);
  mocks.createSignedUrls.mockResolvedValue(new Map());
});

describe("loadAiOverview", () => {
  it("returns an empty overview and touches nothing else when AI is hidden", async () => {
    mocks.getAiAccess.mockResolvedValue({ status: "HIDDEN", message: "x" });
    const db = makeDb({});
    const overview = await loadAiOverview(user, event, db, now);
    expect(overview.access.status).toBe("HIDDEN");
    expect(overview.results).toEqual([]);
    expect(overview.logos).toEqual([]);
    expect(mocks.sweep).not.toHaveBeenCalled();
    expect(mocks.listObjects).not.toHaveBeenCalled();
    expect(mocks.createSignedUrls).not.toHaveBeenCalled();
  });

  it("computes the remaining attempts for the event and the day", async () => {
    const overview = await loadAiOverview(user, event, makeDb({}), now);
    expect(overview.eventRemaining).toBe(2);
    expect(overview.dayRemaining).toBe(11);
    expect(mocks.sweep).toHaveBeenCalledTimes(1);
  });

  it("never reports a negative remaining count", async () => {
    mocks.countEventKind.mockResolvedValue(5);
    mocks.countAccountToday.mockResolvedValue(20);
    const overview = await loadAiOverview(user, event, makeDb({}), now);
    expect([overview.eventRemaining, overview.dayRemaining]).toEqual([0, 0]);
  });

  it("scopes every query to the guarded event and certificate kind", async () => {
    const db = makeDb({}) as unknown as { aiGeneration: { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> } };
    await loadAiOverview(user, event, db as never, now);
    for (const call of [...db.aiGeneration.findFirst.mock.calls, ...db.aiGeneration.findMany.mock.calls]) {
      expect(call[0].where).toMatchObject({ eventId: "ev1", kind: "CERTIFICATE" });
    }
    expect(db.aiGeneration.findMany.mock.calls[0][0].where).toMatchObject({ status: "SUCCEEDED", reportedAt: null, purgedAt: null });
    expect(mocks.listObjects).toHaveBeenCalledWith("ai-generations", "events/ev1");
  });

  it("reports the active design and whether the report allowance is still unused", async () => {
    const config = { lockedAt: null, templateSource: "UPLOAD", backgroundPath: "events/ev1/0123456789abcdef.jpg", aiGenerationId: "g1" };
    const fresh = await loadAiOverview(user, event, makeDb({ config }), now);
    expect(fresh.design).toEqual({ locked: false, hasCustomBackground: true, activeGenerationId: "g1" });
    expect(fresh.reportAvailable).toBe(true);

    const locked = await loadAiOverview(user, event, makeDb({ config: { ...config, lockedAt: now }, reported: 1 }), now);
    expect(locked.design.locked).toBe(true);
    expect(locked.reportAvailable).toBe(false);

    const none = await loadAiOverview(user, event, makeDb({}), now);
    expect(none.design).toEqual({ locked: false, hasCustomBackground: false, activeGenerationId: null });
  });

  it("returns the running generation with its phase", async () => {
    const overview = await loadAiOverview(user, event, makeDb({ running: { id: "gen9", phase: "IMAGE" } }), now);
    expect(overview.running).toEqual({ id: "gen9", phase: "IMAGE" });
  });

  it("lists only logos of this event with signed urls and thumbnails of results", async () => {
    mocks.listObjects.mockResolvedValue([
      "events/ev1/logo-bbbbbbbbbbbbbbbb.png",
      "events/ev1/cert-g1.jpg",
      "events/ev1/logo-aaaaaaaaaaaaaaaa.png",
      "events/ev1/upload-cccccccccccccccc.png",
    ]);
    mocks.createSignedUrls.mockImplementation(async (_bucket: string, paths: string[]) => new Map(paths.map((path) => [path, `https://signed/${path}`])));
    const overview = await loadAiOverview(
      user,
      event,
      makeDb({
        successes: [
          {
            id: "g1",
            createdAt: new Date("2026-10-12T09:00:00Z"),
            resultPaths: ["events/ev1/cert-g1.jpg", "events/ev1/cert-g1-thumb.jpg"],
            input: { style: "minimal", colorHex: null, note: "" },
            firstUsedAt: null,
          },
        ],
      }),
      now,
    );
    expect(overview.logos.map((logo) => logo.path)).toEqual([
      "events/ev1/logo-aaaaaaaaaaaaaaaa.png",
      "events/ev1/logo-bbbbbbbbbbbbbbbb.png",
    ]);
    expect(overview.results).toEqual([
      { id: "g1", createdAt: "2026-10-12T09:00:00.000Z", styleLabel: "Minimalis", thumbUrl: "https://signed/events/ev1/cert-g1-thumb.jpg", used: false },
    ]);
    expect(mocks.createSignedUrls).toHaveBeenCalledWith(
      "ai-generations",
      ["events/ev1/cert-g1-thumb.jpg", "events/ev1/logo-aaaaaaaaaaaaaaaa.png", "events/ev1/logo-bbbbbbbbbbbbbbbb.png"],
      600,
    );
  });

  it("falls back to empty logos and urls when storage fails instead of breaking the page", async () => {
    mocks.listObjects.mockRejectedValue(new Error("storage down"));
    mocks.createSignedUrls.mockRejectedValue(new Error("storage down"));
    const overview = await loadAiOverview(
      user,
      event,
      makeDb({
        successes: [{ id: "g1", createdAt: now, resultPaths: ["a", "b"], input: { style: "minimal", colorHex: null, note: "" } }],
      }),
      now,
    );
    expect(overview.logos).toEqual([]);
    expect(overview.results[0].thumbUrl).toBeNull();
  });

  it("prefills the form from the latest generation", async () => {
    const overview = await loadAiOverview(
      user,
      event,
      makeDb({ latest: { id: "g2", status: "SUCCEEDED", failureCode: null, finishedAt: now, input: { style: "cheerful", colorHex: "#16a34a", note: "daun" } } }),
      now,
    );
    expect(overview.defaults).toEqual({ style: "cheerful", colorHex: "#16a34a", note: "daun" });
    expect(overview.failure).toBeNull();
  });

  it("shows the generic failure message for a recent failed generation and hides an old one", async () => {
    const recent = { id: "g3", status: "FAILED", failureCode: "VENDOR_CONFIG", finishedAt: new Date(now.getTime() - 60_000), input: { style: "minimal", colorHex: null, note: "" } };
    const shown = await loadAiOverview(user, event, makeDb({ latest: recent }), now);
    expect(shown.failure).toEqual({ id: "g3", message: "Desain belum berhasil dibuat. Kuota tidak berkurang. Coba lagi sebentar lagi." });

    const old = { ...recent, finishedAt: new Date(now.getTime() - 3 * 60 * 60 * 1000) };
    expect((await loadAiOverview(user, event, makeDb({ latest: old }), now)).failure).toBeNull();
  });

  it("uses the busy message when the vendor was at capacity and the note message when rejected", async () => {
    const base = { id: "g4", finishedAt: now, input: { style: "minimal", colorHex: null, note: "x" } };
    const busy = await loadAiOverview(user, event, makeDb({ latest: { ...base, status: "FAILED", failureCode: "VENDOR_CAPACITY" } }), now);
    expect(busy.failure?.message).toMatch(/sedang sibuk/);
    const rejected = await loadAiOverview(user, event, makeDb({ latest: { ...base, status: "REJECTED", failureCode: "VENDOR_SAFETY" } }), now);
    expect(rejected.failure?.message).toMatch(/Keterangan tambahan tidak bisa diproses/);
  });
});
