import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  disableUser: vi.fn(),
  enableUser: vi.fn(),
  listAdminUsers: vi.fn(),
  getAdminUserDetail: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND_PAGE");
  },
}));
vi.mock("@/server/authz", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/server/admin-users", () => ({
  disableUser: mocks.disableUser,
  enableUser: mocks.enableUser,
  listAdminUsers: mocks.listAdminUsers,
  getAdminUserDetail: mocks.getAdminUserDetail,
}));

const { disableUserAction, enableUserAction } = await import("@/app/admin/users/actions");
const { default: AdminUsersPage } = await import("@/app/admin/users/page");
const { default: AdminUserDetailPage } = await import("@/app/admin/users/[id]/page");

function form(reason: string) {
  const data = new FormData();
  data.set("reason", reason);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin users authorization", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockRejectedValue(new Error("NOT_FOUND"));
  });

  it("blocks the list page for non-admins", async () => {
    await expect(AdminUsersPage({ searchParams: Promise.resolve({}) } as never)).rejects.toThrow("NOT_FOUND");
    expect(mocks.listAdminUsers).not.toHaveBeenCalled();
  });

  it("blocks the detail page for non-admins", async () => {
    await expect(AdminUserDetailPage({ params: Promise.resolve({ id: "u1" }) } as never)).rejects.toThrow("NOT_FOUND");
    expect(mocks.getAdminUserDetail).not.toHaveBeenCalled();
  });

  it("blocks disabling for non-admins", async () => {
    await expect(disableUserAction("u1", {}, form("Melanggar aturan"))).rejects.toThrow("NOT_FOUND");
    expect(mocks.disableUser).not.toHaveBeenCalled();
  });

  it("blocks enabling for non-admins", async () => {
    await expect(enableUserAction("u1")).rejects.toThrow("NOT_FOUND");
    expect(mocks.enableUser).not.toHaveBeenCalled();
  });
});

describe("list page", () => {
  it("passes validated filters and page to the query", async () => {
    mocks.requireAdmin.mockResolvedValue({ id: "admin1", role: "ADMIN" });
    mocks.listAdminUsers.mockResolvedValue({ rows: [], total: 0, pageCount: 1 });
    await AdminUsersPage({
      searchParams: Promise.resolve({ q: "  budi ", role: "ORGANIZER", status: "bogus", page: "3" }),
    } as never);
    expect(mocks.listAdminUsers).toHaveBeenCalledWith({ query: "budi", role: "ORGANIZER", status: null }, 3);
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
});
