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
  getAdminStats: async () => ({
    events: { draft: 0, published: 0, cancelled: 0, disabled: 0 },
    users: { participants: 0, organizers: 0, admins: 0 },
    registrations24h: 0,
    registrations7d: 0,
    checkedInTotal: 0,
    checkedIn24h: 0,
    certificatesIssued: 0,
    errors24h: 0,
    dbSizeBytes: 0,
    dbQuotaBytes: 1,
    emailsSent24h: 0,
    emailBudget: 95,
    registrationsDaily: [],
    usersWeekly: [],
    publishedEventsWeekly: [],
  }),
}));

const { default: OrganizerDashboardPage } = await import("@/app/organizer/page");
const { default: AdminPage } = await import("@/app/admin/page");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("/organizer", () => {
  it("is blocked when requireOrganizer rejects", async () => {
    mocks.requireOrganizer.mockRejectedValue(new Error("REDIRECT:/organizer/register"));
    await expect(OrganizerDashboardPage()).rejects.toThrow("REDIRECT:/organizer/register");
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
    mocks.requireAdmin.mockResolvedValue({ id: "u1", role: "ADMIN" });
    await expect(AdminPage()).resolves.toBeTruthy();
  });
});
