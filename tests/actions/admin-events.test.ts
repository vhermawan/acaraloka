import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recordError: vi.fn(async () => undefined),
  requireAdmin: vi.fn(),
  disableEvent: vi.fn(),
  enableEvent: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", async () => (await import("../mocks/next-navigation")).nextNavigationMock);
vi.mock("@/server/error-log", () => ({ recordError: mocks.recordError }));
vi.mock("@/server/authz", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/server/admin-events", () => ({ disableEvent: mocks.disableEvent, enableEvent: mocks.enableEvent }));

const { ACTION_ERROR_MESSAGE } = await import("@/actions/_lib/handle-action-error");
const { disableEventAction, enableEventAction } = await import("@/actions/admin-events");

function form(reason: string) {
  const data = new FormData();
  data.set("reason", reason);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin events actions for non-admins", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockRejectedValue(new Error("NOT_FOUND"));
  });

  it("blocks disabling", async () => {
    await expect(disableEventAction("e1", {}, form("Melanggar aturan"))).rejects.toThrow("NOT_FOUND");
    expect(mocks.disableEvent).not.toHaveBeenCalled();
    expect(mocks.recordError).not.toHaveBeenCalled();
  });

  it("blocks enabling", async () => {
    await expect(enableEventAction("e1")).rejects.toThrow("NOT_FOUND");
    expect(mocks.enableEvent).not.toHaveBeenCalled();
    expect(mocks.recordError).not.toHaveBeenCalled();
  });
});

describe("disableEventAction", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockResolvedValue({ id: "admin1", role: "ADMIN" });
  });

  it("requires a reason", async () => {
    const state = await disableEventAction("e1", {}, form("  "));
    expect(state.error).toBeTruthy();
    expect(mocks.disableEvent).not.toHaveBeenCalled();
  });

  it("passes the trimmed reason and admin to the server function and revalidates", async () => {
    mocks.disableEvent.mockResolvedValue({ ok: true, slug: "s" });
    expect(await disableEventAction("e1", {}, form(" Melanggar aturan "))).toEqual({ done: true });
    expect(mocks.disableEvent).toHaveBeenCalledWith({ eventId: "e1", actorId: "admin1", reason: "Melanggar aturan" });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/e/s");
  });

  it.each([
    ["ALREADY_DISABLED", "Acara ini sudah dinonaktifkan."],
    ["NOT_FOUND", "Acara tidak ditemukan."],
  ])("reports %s", async (reason, message) => {
    mocks.disableEvent.mockResolvedValue({ ok: false, reason });
    const state = await disableEventAction("e1", {}, form("Melanggar aturan"));
    expect(state).toEqual({ error: message, values: { reason: "Melanggar aturan" } });
  });

  it("keeps the typed reason, returns a friendly error and records an unexpected failure", async () => {
    const failure = new Error("db down");
    mocks.disableEvent.mockRejectedValue(failure);
    expect(await disableEventAction("e1", {}, form("Melanggar aturan"))).toEqual({
      error: ACTION_ERROR_MESSAGE,
      values: { reason: "Melanggar aturan" },
    });
    expect(mocks.recordError).toHaveBeenCalledWith({ source: "action.disableEventAction", error: failure });
  });
});

describe("enableEventAction", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockResolvedValue({ id: "admin1", role: "ADMIN" });
  });

  it("enables with the session admin as actor", async () => {
    mocks.enableEvent.mockResolvedValue({ ok: true, slug: "s" });
    expect(await enableEventAction("e1")).toEqual({});
    expect(mocks.enableEvent).toHaveBeenCalledWith({ eventId: "e1", actorId: "admin1" });
  });

  it.each([
    ["NOT_FOUND", "Acara tidak ditemukan."],
    ["NOT_DISABLED", "Acara ini tidak sedang dinonaktifkan."],
  ])("reports %s", async (reason, message) => {
    mocks.enableEvent.mockResolvedValue({ ok: false, reason });
    expect(await enableEventAction("e1")).toEqual({ error: message });
  });

  it("returns a friendly error and records an unexpected failure", async () => {
    const failure = new Error("db down");
    mocks.enableEvent.mockRejectedValue(failure);
    expect(await enableEventAction("e1")).toEqual({ error: ACTION_ERROR_MESSAGE });
    expect(mocks.recordError).toHaveBeenCalledWith({ source: "action.enableEventAction", error: failure });
  });
});
