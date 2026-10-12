import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recordError: vi.fn(async () => undefined),
  requireAdmin: vi.fn(),
  disableUser: vi.fn(),
  enableUser: vi.fn(),
  listAdminUsers: vi.fn(),
  getAdminUserDetail: vi.fn(),
}));

vi.mock("next/navigation", async () => (await import("../mocks/next-navigation")).nextNavigationMock);
vi.mock("@/server/error-log", () => ({ recordError: mocks.recordError }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/authz", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/server/admin-users", () => ({
  disableUser: mocks.disableUser,
  enableUser: mocks.enableUser,
  listAdminUsers: mocks.listAdminUsers,
  getAdminUserDetail: mocks.getAdminUserDetail,
}));

const { default: AdminUsersPage } = await import("@/app/admin/users/page");
const { default: AdminUserDetailPage } = await import("@/app/admin/users/[id]/page");

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
