import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recordError: vi.fn(async () => undefined),
}));

vi.mock("next/navigation", async () => (await import("../mocks/next-navigation")).nextNavigationMock);
vi.mock("@/server/error-log", () => ({ recordError: mocks.recordError }));

const { ACTION_ERROR_MESSAGE, ACTION_FAILED, runAction, runLoggedAction } = await import(
  "@/actions/_lib/handle-action-error"
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runAction", () => {
  it("returns the result of a successful run without logging", async () => {
    await expect(runAction("action.test", ACTION_FAILED, async () => ({ ok: true }))).resolves.toEqual({ ok: true });
    expect(mocks.recordError).not.toHaveBeenCalled();
  });

  it("records an unexpected error and returns the friendly fallback", async () => {
    const failure = new Error("db down");
    await expect(runAction("action.test", ACTION_FAILED, async () => Promise.reject(failure))).resolves.toEqual({
      error: ACTION_ERROR_MESSAGE,
    });
    expect(mocks.recordError).toHaveBeenCalledWith({ source: "action.test", error: failure });
  });

  it.each(["REDIRECT:/login", "NOT_FOUND"])("rethrows the Next.js signal %s without logging", async (message) => {
    await expect(runAction("action.test", ACTION_FAILED, async () => Promise.reject(new Error(message)))).rejects.toThrow(
      message,
    );
    expect(mocks.recordError).not.toHaveBeenCalled();
  });

  it("still returns the fallback when logging itself fails", async () => {
    mocks.recordError.mockRejectedValueOnce(new Error("log down"));
    await expect(runAction("action.test", ACTION_FAILED, async () => Promise.reject(new Error("x")))).resolves.toEqual(
      ACTION_FAILED,
    );
  });
});

describe("runLoggedAction", () => {
  it("returns the result of a successful run", async () => {
    await expect(runLoggedAction("action.test", async () => 5)).resolves.toBe(5);
    expect(mocks.recordError).not.toHaveBeenCalled();
  });

  it("records an unexpected error and rethrows it", async () => {
    const failure = new Error("db down");
    await expect(runLoggedAction("action.test", async () => Promise.reject(failure))).rejects.toBe(failure);
    expect(mocks.recordError).toHaveBeenCalledWith({ source: "action.test", error: failure });
  });

  it("rethrows a Next.js signal without logging", async () => {
    await expect(runLoggedAction("action.test", async () => Promise.reject(new Error("REDIRECT:/x")))).rejects.toThrow(
      "REDIRECT:/x",
    );
    expect(mocks.recordError).not.toHaveBeenCalled();
  });
});
