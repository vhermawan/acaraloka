import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireOrganizer: vi.fn(),
  requireAdmin: vi.fn(),
}));

vi.mock("@/server/authz", () => mocks);
vi.mock("@/server/db", () => ({
  prisma: { event: { findMany: async () => [] } },
}));
vi.mock("@/server/admin-stats", () => ({
  getAdminStats: async () => ({ publishedEvents: 0, registrations24h: 0, errors24h: 0, dbSizeBytes: 0 }),
}));

const { default: OrganizerDashboardPage } = await import("@/app/organizer/page");
const { default: AdminPage } = await import("@/app/admin/page");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/organizer", () => {
  it("is blocked when requireOrganizer rejects", async () => {
    mocks.requireOrganizer.mockRejectedValue(new Error("REDIRECT:/organizer/join"));
    await expect(OrganizerDashboardPage()).rejects.toThrow("REDIRECT:/organizer/join");
  });

  it("renders for organizers", async () => {
    mocks.requireOrganizer.mockResolvedValue({ user: { id: "u1" }, organizer: { orgName: "HIMA" } });
    await expect(OrganizerDashboardPage()).resolves.toBeTruthy();
  });
});

describe("/admin", () => {
  it("is blocked for non-admins", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(AdminPage()).rejects.toThrow("NOT_FOUND");
  });

  it("renders for admins", async () => {
    mocks.requireAdmin.mockResolvedValue({ id: "u1", isAdmin: true });
    await expect(AdminPage()).resolves.toBeTruthy();
  });
});
