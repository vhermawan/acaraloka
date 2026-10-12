import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recordError: vi.fn(async () => undefined),
  requireAdmin: vi.fn(),
  runManualDrain: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", async () => (await import("../mocks/next-navigation")).nextNavigationMock);
vi.mock("@/server/error-log", () => ({ recordError: mocks.recordError }));
vi.mock("@/server/authz", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/server/admin-email", () => ({ runManualDrain: mocks.runManualDrain }));

const { ACTION_ERROR_MESSAGE } = await import("@/actions/_lib/handle-action-error");
const { drainQueueAction } = await import("@/actions/admin-email");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("drainQueueAction", () => {
  it("blocks non-admins and rethrows the guard signal", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(drainQueueAction()).rejects.toThrow("NOT_FOUND");
    expect(mocks.runManualDrain).not.toHaveBeenCalled();
    expect(mocks.recordError).not.toHaveBeenCalled();
  });

  describe("as admin", () => {
    beforeEach(() => {
      mocks.requireAdmin.mockResolvedValue({ id: "admin1", role: "ADMIN" });
    });

    it("drains with the session admin as actor and summarises the result", async () => {
      mocks.runManualDrain.mockResolvedValue({ ok: true, skipped: false, sent: 3, failed: 1, retrying: 2, rateLimited: false });
      const state = await drainQueueAction();
      expect(mocks.runManualDrain).toHaveBeenCalledWith({ actorId: "admin1" });
      expect(state.message).toBe("3 terkirim, 1 gagal, 2 akan dicoba ulang.");
      expect(state.error).toBeUndefined();
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/email");
    });

    it("reports a drain that another process is already running", async () => {
      mocks.runManualDrain.mockResolvedValue({ ok: true, skipped: true });
      expect((await drainQueueAction()).message).toMatch(/proses lain/);
    });

    it.each(["DISABLED", "COOLDOWN", "FAILED"])("reports %s as an error", async (reason) => {
      mocks.runManualDrain.mockResolvedValue({ ok: false, reason });
      const state = await drainQueueAction();
      expect(state.error).toBeTruthy();
      expect(state.message).toBeUndefined();
    });

    it("returns a friendly error and records an unexpected failure", async () => {
      const failure = new Error("db down");
      mocks.runManualDrain.mockRejectedValue(failure);
      expect(await drainQueueAction()).toEqual({ error: ACTION_ERROR_MESSAGE });
      expect(mocks.recordError).toHaveBeenCalledWith({ source: "action.drainQueueAction", error: failure });
    });
  });
});
