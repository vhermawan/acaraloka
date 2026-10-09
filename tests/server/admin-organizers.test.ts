import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  listAdminOrganizers: vi.fn(),
  getAdminOrganizerDetail: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND_PAGE");
  },
}));
vi.mock("@/server/authz", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/server/admin-organizers", () => ({
  listAdminOrganizers: mocks.listAdminOrganizers,
  getAdminOrganizerDetail: mocks.getAdminOrganizerDetail,
}));
vi.mock("@/server/admin-users", () => ({ disableUser: vi.fn(), enableUser: vi.fn() }));

const { default: AdminOrganizersPage } = await import("@/app/admin/organizers/page");
const { default: AdminOrganizerDetailPage } = await import("@/app/admin/organizers/[id]/page");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin organizers authorization", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockRejectedValue(new Error("NOT_FOUND"));
  });

  it("blocks the list page for non-admins without querying", async () => {
    await expect(AdminOrganizersPage({ searchParams: Promise.resolve({}) } as never)).rejects.toThrow("NOT_FOUND");
    expect(mocks.listAdminOrganizers).not.toHaveBeenCalled();
  });

  it("blocks the detail page for non-admins without querying", async () => {
    await expect(AdminOrganizerDetailPage({ params: Promise.resolve({ id: "u1" }) } as never)).rejects.toThrow("NOT_FOUND");
    expect(mocks.getAdminOrganizerDetail).not.toHaveBeenCalled();
  });
});

describe("admin organizers pages for admins", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockResolvedValue({ id: "admin1", role: "ADMIN" });
  });

  it("passes validated search and sort to the query", async () => {
    mocks.listAdminOrganizers.mockResolvedValue({ rows: [], total: 0, pageCount: 1 });
    await AdminOrganizersPage({
      searchParams: Promise.resolve({ q: " hima ", sort: "bogus", page: "abc" }),
    } as never);
    expect(mocks.listAdminOrganizers).toHaveBeenCalledWith({ query: "hima", sort: "newest" }, 1);
  });

  it("returns 404 when the user has no organizer profile", async () => {
    mocks.getAdminOrganizerDetail.mockResolvedValue(null);
    await expect(AdminOrganizerDetailPage({ params: Promise.resolve({ id: "ghost" }) } as never)).rejects.toThrow(
      "NOT_FOUND_PAGE",
    );
  });
});
