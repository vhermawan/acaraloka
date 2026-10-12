import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recordError: vi.fn(async () => undefined),
  requireEventOwner: vi.fn(),
  cancelRegistration: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", async () => (await import("../mocks/next-navigation")).nextNavigationMock);
vi.mock("@/server/error-log", () => ({ recordError: mocks.recordError }));
vi.mock("@/server/authz", () => ({ requireEventOwner: mocks.requireEventOwner }));
vi.mock("@/server/cancellation", () => ({ cancelRegistration: mocks.cancelRegistration }));

const { ACTION_ERROR_MESSAGE } = await import("@/actions/_lib/handle-action-error");
const { cancelParticipant } = await import("@/actions/event-participants");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cancelRegistration.mockReset();
  mocks.requireEventOwner.mockResolvedValue({ user: { id: "u1" }, event: { id: "e1", slug: "acara", status: "PUBLISHED" } });
});

describe("cancelParticipant", () => {
  it("rethrows the guard signal for non-owners", async () => {
    mocks.requireEventOwner.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(cancelParticipant("e1", "r1", "")).rejects.toThrow("NOT_FOUND");
    expect(mocks.cancelRegistration).not.toHaveBeenCalled();
    expect(mocks.recordError).not.toHaveBeenCalled();
  });

  it("refuses disabled events", async () => {
    mocks.requireEventOwner.mockResolvedValue({ user: { id: "u1" }, event: { id: "e1", slug: "acara", status: "DISABLED" } });
    expect(await cancelParticipant("e1", "r1", "")).toEqual({ error: "Acara ini dinonaktifkan admin." });
    expect(mocks.cancelRegistration).not.toHaveBeenCalled();
  });

  it("rejects an overly long reason", async () => {
    const result = await cancelParticipant("e1", "r1", "x".repeat(501));
    expect(result.error).toBeTruthy();
    expect(mocks.cancelRegistration).not.toHaveBeenCalled();
  });

  it("cancels with the guarded event and a default reason", async () => {
    mocks.cancelRegistration.mockResolvedValue({ ok: true });
    expect(await cancelParticipant("e1", "r1", "")).toEqual({});
    expect(mocks.cancelRegistration).toHaveBeenCalledWith({
      registrationId: "r1",
      eventId: "e1",
      actorId: "u1",
      reason: "Dibatalkan oleh panitia",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/e/acara");
  });

  it("reports a registration that cannot be cancelled", async () => {
    mocks.cancelRegistration.mockResolvedValue({ ok: false });
    expect((await cancelParticipant("e1", "r1", "")).error).toMatch(/belum check-in/);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns a friendly error and records an unexpected failure", async () => {
    const failure = new Error("db down");
    mocks.cancelRegistration.mockRejectedValue(failure);
    expect(await cancelParticipant("e1", "r1", "")).toEqual({ error: ACTION_ERROR_MESSAGE });
    expect(mocks.recordError).toHaveBeenCalledWith({ source: "action.cancelParticipant", error: failure });
  });
});
