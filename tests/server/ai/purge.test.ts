import { beforeEach, describe, expect, it, vi } from "vitest";

const removeObjects = vi.hoisted(() => vi.fn());
const listObjects = vi.hoisted(() => vi.fn());
const reportCleanupFailure = vi.hoisted(() => vi.fn());

vi.mock("@/server/storage", () => ({ AI_BUCKET: "ai-generations", removeObjects, listObjects }));
vi.mock("@/server/storage-cleanup", () => ({ reportCleanupFailure }));

const { purgeAiArtifacts, AI_PURGE_MAX_OBJECTS } = await import("@/server/ai/purge");

function makeDb(overrides: { results?: unknown[]; failed?: unknown[]; events?: unknown[] } = {}) {
  const findMany = vi.fn(async (args: { where: { status: string } }) =>
    args.where.status === "SUCCEEDED" ? (overrides.results ?? []) : (overrides.failed ?? []),
  );
  const updateMany = vi.fn(async () => ({ count: 1 }));
  return {
    db: {
      aiGeneration: { findMany, updateMany },
      event: { findMany: vi.fn(async () => overrides.events ?? []) },
    } as never,
    findMany,
    updateMany,
  };
}

const rows = (count: number, prefix: string) => Array.from({ length: count }, (_, index) => ({ id: `${prefix}${index}`, eventId: "ev" }));

describe("purgeAiArtifacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    removeObjects.mockResolvedValue(undefined);
    listObjects.mockResolvedValue([]);
  });

  it("never asks for more rows than the object budget allows", async () => {
    const { db, findMany } = makeDb();

    await purgeAiArtifacts(db);

    expect(findMany.mock.calls[0]?.[0]).toMatchObject({ take: AI_PURGE_MAX_OBJECTS / 2 });
  });

  it("shares the budget between steps and removes only logo files", async () => {
    const { db } = makeDb({ results: rows(100, "r"), events: [{ id: "ev" }] });
    listObjects.mockResolvedValue(["events/ev/logo-0123456789abcdef.png", "events/ev/cert-x.jpg"]);

    const result = await purgeAiArtifacts(db);

    expect(result).toMatchObject({ unusedResults: 100, failedRows: 0, logoObjects: 0, objectsRemoved: 200 });
    expect(listObjects).not.toHaveBeenCalled();
  });

  it("removes ended-event logos and ignores other files", async () => {
    const { db } = makeDb({ events: [{ id: "ev" }] });
    listObjects.mockResolvedValue(["events/ev/logo-0123456789abcdef.png", "events/ev/upload-0123456789abcdef.jpg", "events/ev/cert-x.jpg"]);

    const result = await purgeAiArtifacts(db);

    expect(result.logoObjects).toBe(2);
    expect(removeObjects).toHaveBeenCalledWith("ai-generations", ["events/ev/logo-0123456789abcdef.png", "events/ev/upload-0123456789abcdef.jpg"]);
  });

  it("releases the claim and reports when removal fails, then continues with the next step", async () => {
    const { db, updateMany } = makeDb({ results: rows(2, "r"), failed: rows(1, "f") });
    removeObjects.mockRejectedValueOnce(new Error("boom"));

    const result = await purgeAiArtifacts(db);

    expect(reportCleanupFailure).toHaveBeenCalledWith("ai.purge.results", expect.any(Error), expect.any(Object));
    expect(updateMany).toHaveBeenCalledWith({ where: { id: { in: ["r0", "r1"] } }, data: { purgedAt: null } });
    expect(result).toMatchObject({ unusedResults: 0, failedRows: 1 });
  });

  it("keeps failed rows unmarked when removal fails", async () => {
    const { db, updateMany } = makeDb({ failed: rows(1, "f") });
    removeObjects.mockRejectedValueOnce(new Error("boom"));

    const result = await purgeAiArtifacts(db);

    expect(result.failedRows).toBe(0);
    expect(updateMany).not.toHaveBeenCalled();
  });
});
