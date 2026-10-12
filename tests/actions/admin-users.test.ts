import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recordError: vi.fn(async () => undefined),
  requireAdmin: vi.fn(),
  disableUser: vi.fn(),
  enableUser: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", async () => (await import("../mocks/next-navigation")).nextNavigationMock);
vi.mock("@/server/error-log", () => ({ recordError: mocks.recordError }));
vi.mock("@/server/authz", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/server/admin-users", () => ({ disableUser: mocks.disableUser, enableUser: mocks.enableUser }));

const { ACTION_ERROR_MESSAGE } = await import("@/actions/_lib/handle-action-error");
const { disableUserAction, enableUserAction } = await import("@/actions/admin-users");

function form(reason: string) {
  const data = new FormData();
  data.set("reason", reason);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin users actions for non-admins", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockRejectedValue(new Error("NOT_FOUND"));
  });

  it("blocks disabling", async () => {
    await expect(disableUserAction("u1", {}, form("Melanggar aturan"))).rejects.toThrow("NOT_FOUND");
    expect(mocks.disableUser).not.toHaveBeenCalled();
    expect(mocks.recordError).not.toHaveBeenCalled();
  });

  it("blocks enabling", async () => {
    await expect(enableUserAction("u1")).rejects.toThrow("NOT_FOUND");
    expect(mocks.enableUser).not.toHaveBeenCalled();
    expect(mocks.recordError).not.toHaveBeenCalled();
  });
});

describe("disableUserAction", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockResolvedValue({ id: "admin1", role: "ADMIN" });
  });

  it("requires a reason", async () => {
    const state = await disableUserAction("u1", {}, form("  "));
    expect(state.error).toBeTruthy();
    expect(mocks.disableUser).not.toHaveBeenCalled();
  });

  it("rejects an overly long reason", async () => {
    const state = await disableUserAction("u1", {}, form("x".repeat(501)));
    expect(state.error).toBeTruthy();
    expect(mocks.disableUser).not.toHaveBeenCalled();
  });

  it("passes the trimmed reason and the session admin to the server function", async () => {
    mocks.disableUser.mockResolvedValue({ ok: true, revokedSessions: 2 });
    expect(await disableUserAction("u1", {}, form(" Melanggar aturan "))).toEqual({ done: true });
    expect(mocks.disableUser).toHaveBeenCalledWith({ userId: "u1", actorId: "admin1", reason: "Melanggar aturan" });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/users/u1");
  });

  it.each([
    ["SELF", "Kamu tidak bisa menonaktifkan akunmu sendiri."],
    ["ADMIN_TARGET", "Akun admin tidak bisa dinonaktifkan dari panel ini."],
    ["ALREADY_DISABLED", "Pengguna ini sudah dinonaktifkan."],
    ["NOT_FOUND", "Pengguna tidak ditemukan."],
  ])("reports %s", async (reason, message) => {
    mocks.disableUser.mockResolvedValue({ ok: false, reason });
    const state = await disableUserAction("u1", {}, form("Melanggar aturan"));
    expect(state.error).toBe(message);
    expect(state.done).toBeUndefined();
  });

  it("keeps the typed reason, returns a friendly error and records an unexpected failure", async () => {
    const failure = new Error("db down");
    mocks.disableUser.mockRejectedValue(failure);
    expect(await disableUserAction("u1", {}, form("Melanggar aturan"))).toEqual({
      error: ACTION_ERROR_MESSAGE,
      values: { reason: "Melanggar aturan" },
    });
    expect(mocks.recordError).toHaveBeenCalledWith({ source: "action.disableUserAction", error: failure });
  });
});

describe("enableUserAction", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockResolvedValue({ id: "admin1", role: "ADMIN" });
  });

  it("enables with the session admin as actor", async () => {
    mocks.enableUser.mockResolvedValue({ ok: true });
    expect(await enableUserAction("u1")).toEqual({});
    expect(mocks.enableUser).toHaveBeenCalledWith({ userId: "u1", actorId: "admin1" });
  });

  it("reports a user that is not disabled", async () => {
    mocks.enableUser.mockResolvedValue({ ok: false, reason: "NOT_DISABLED" });
    expect((await enableUserAction("u1")).error).toBe("Pengguna ini tidak sedang dinonaktifkan.");
  });

  it("returns a friendly error and records an unexpected failure", async () => {
    const failure = new Error("db down");
    mocks.enableUser.mockRejectedValue(failure);
    expect(await enableUserAction("u1")).toEqual({ error: ACTION_ERROR_MESSAGE });
    expect(mocks.recordError).toHaveBeenCalledWith({ source: "action.enableUserAction", error: failure });
  });
});
