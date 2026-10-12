import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recordError: vi.fn(async () => undefined),
}));

vi.mock("@/server/error-log", () => ({ recordError: mocks.recordError }));

const { notFound, redirect } = await import("next/navigation");
const { ACTION_FAILED, runAction, runLoggedAction } = await import("@/actions/_lib/handle-action-error");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("with the real Next.js navigation errors", () => {
  it("runAction rethrows redirect() without logging", async () => {
    const promise = runAction("action.test", ACTION_FAILED, async () => redirect("/login"));
    await expect(promise).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
    expect(mocks.recordError).not.toHaveBeenCalled();
  });

  it("runAction rethrows notFound() without logging", async () => {
    const promise = runAction("action.test", ACTION_FAILED, async () => notFound());
    await expect(promise).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK") });
    expect(mocks.recordError).not.toHaveBeenCalled();
  });

  it("runLoggedAction rethrows both without logging", async () => {
    await expect(runLoggedAction("action.test", async () => redirect("/x"))).rejects.toBeDefined();
    await expect(runLoggedAction("action.test", async () => notFound())).rejects.toBeDefined();
    expect(mocks.recordError).not.toHaveBeenCalled();
  });

  it("still logs an ordinary error", async () => {
    await expect(runAction("action.test", ACTION_FAILED, async () => Promise.reject(new Error("x")))).resolves.toEqual(ACTION_FAILED);
    expect(mocks.recordError).toHaveBeenCalledTimes(1);
  });
});
