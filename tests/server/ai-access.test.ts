import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({ prisma: {} }));

const { getAiAccess } = await import("@/server/ai-access");

function fakeDb(allowed: boolean) {
  return {
    aiAllowlist: { findUnique: vi.fn().mockResolvedValue(allowed ? { userId: "u1" } : null) },
    aiGeneration: { aggregate: vi.fn().mockResolvedValue({ _sum: { costMicros: 0, estCostMicros: 0 } }) },
    event: { findUnique: vi.fn() },
  };
}

const limits = { monthlyCapUsd: 10, trialCapUsd: 30, trialEndsOn: null, globalDailyLimit: 40 };

describe("getAiAccess", () => {
  it("returns the same hidden answer for flag off and non-allowlisted accounts", async () => {
    const flagOffDb = fakeDb(true);
    const flagOff = await getAiAccess({ id: "u1" }, null, { db: flagOffDb as never, enabled: false, limits });
    const outsider = await getAiAccess({ id: "u1" }, null, { db: fakeDb(false) as never, enabled: true, limits });

    expect(flagOff).toEqual({ status: "HIDDEN", message: "Fitur AI sedang tidak tersedia." });
    expect(outsider).toEqual(flagOff);
    expect(flagOffDb.aiAllowlist.findUnique).not.toHaveBeenCalled();
  });

  it("is available for an allowlisted account under the cap", async () => {
    const result = await getAiAccess({ id: "u1" }, null, { db: fakeDb(true) as never, enabled: true, limits });
    expect(result).toEqual({ status: "AVAILABLE", remaining: null });
  });

  it("pauses when the month's spend leaves no room for another generation", async () => {
    const db = fakeDb(true);
    db.aiGeneration.aggregate.mockResolvedValue({ _sum: { costMicros: 9_990_000, estCostMicros: 0 } });
    const result = await getAiAccess({ id: "u1" }, null, { db: db as never, enabled: true, limits });
    expect(result.status).toBe("PAUSED");
  });
});
