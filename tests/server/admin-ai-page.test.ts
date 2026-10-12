import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getAdminAiSummary: vi.fn(),
  listRecentAiGenerations: vi.fn(),
  listAiAllowlist: vi.fn(),
}));

vi.mock("@/server/authz", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/server/admin-ai", () => ({
  getAdminAiSummary: mocks.getAdminAiSummary,
  listRecentAiGenerations: mocks.listRecentAiGenerations,
  listAiAllowlist: mocks.listAiAllowlist,
}));
vi.mock("@/app/admin/ai/actions", () => ({
  addAiAllowlistAction: vi.fn(),
  removeAiAllowlistAction: vi.fn(),
}));

const { default: AdminAiPage } = await import("@/app/admin/ai/page");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAdminAiSummary.mockResolvedValue({
    status: "DISABLED",
    capUsd: 10,
    trial: false,
    trialEndsOn: null,
    spentUsd: 0,
    spentPercent: 0,
    todayCount: 0,
    globalDailyLimit: 40,
  });
  mocks.listRecentAiGenerations.mockResolvedValue({ rows: [], thumbsFailed: false });
  mocks.listAiAllowlist.mockResolvedValue([]);
});

describe("/admin/ai", () => {
  it("is blocked for non-admins before reading any data", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(AdminAiPage()).rejects.toThrow("NOT_FOUND");
    expect(mocks.getAdminAiSummary).not.toHaveBeenCalled();
    expect(mocks.listRecentAiGenerations).not.toHaveBeenCalled();
    expect(mocks.listAiAllowlist).not.toHaveBeenCalled();
  });

  it("renders for admins even when AI is disabled", async () => {
    mocks.requireAdmin.mockResolvedValue({ id: "a1", role: "ADMIN" });
    await expect(AdminAiPage()).resolves.toBeTruthy();
  });
});
