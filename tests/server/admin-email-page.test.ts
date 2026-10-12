import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recordError: vi.fn(async () => undefined),
  requireAdmin: vi.fn(),
  runManualDrain: vi.fn(),
  getEmailOverview: vi.fn(),
  listEmailOutbox: vi.fn(),
}));

vi.mock("next/navigation", async () => (await import("../mocks/next-navigation")).nextNavigationMock);
vi.mock("@/server/error-log", () => ({ recordError: mocks.recordError }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/authz", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/server/admin-email", () => ({
  runManualDrain: mocks.runManualDrain,
  getEmailOverview: mocks.getEmailOverview,
  listEmailOutbox: mocks.listEmailOutbox,
}));

const { default: AdminEmailPage } = await import("@/app/admin/email/page");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin email authorization", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockRejectedValue(new Error("NOT_FOUND"));
  });

  it("blocks the page for non-admins", async () => {
    await expect(AdminEmailPage({ searchParams: Promise.resolve({}) } as never)).rejects.toThrow("NOT_FOUND");
    expect(mocks.getEmailOverview).not.toHaveBeenCalled();
    expect(mocks.listEmailOutbox).not.toHaveBeenCalled();
  });
});

describe("page", () => {
  it("passes validated filters and page to the query", async () => {
    mocks.requireAdmin.mockResolvedValue({ id: "admin1", role: "ADMIN" });
    mocks.getEmailOverview.mockResolvedValue({
      sent24h: 0,
      failed24h: 0,
      queued: 0,
      scheduled: 0,
      budget: 95,
      remainingBudget: 95,
      enabled: true,
    });
    mocks.listEmailOutbox.mockResolvedValue({ rows: [], total: 0, pageCount: 1 });
    await AdminEmailPage({
      searchParams: Promise.resolve({ status: "FAILED", template: "bogus", page: "2" }),
    } as never);
    expect(mocks.listEmailOutbox).toHaveBeenCalledWith({ status: "FAILED", template: null }, 2);
  });
});
