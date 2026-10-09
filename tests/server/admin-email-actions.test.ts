import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  runManualDrain: vi.fn(),
  getEmailOverview: vi.fn(),
  listEmailOutbox: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/authz", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/server/admin-email", () => ({
  runManualDrain: mocks.runManualDrain,
  getEmailOverview: mocks.getEmailOverview,
  listEmailOutbox: mocks.listEmailOutbox,
}));

const { drainQueueAction } = await import("@/app/admin/email/actions");
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

  it("blocks the drain action for non-admins", async () => {
    await expect(drainQueueAction()).rejects.toThrow("NOT_FOUND");
    expect(mocks.runManualDrain).not.toHaveBeenCalled();
  });
});

describe("page", () => {
  it("passes validated filters and page to the query", async () => {
    mocks.requireAdmin.mockResolvedValue({ id: "admin1", role: "ADMIN" });
    mocks.getEmailOverview.mockResolvedValue({
      sent24h: 0,
      failed24h: 0,
      queued: 0,
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

describe("drainQueueAction", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockResolvedValue({ id: "admin1", role: "ADMIN" });
  });

  it("drains with the session admin as actor and summarises the result", async () => {
    mocks.runManualDrain.mockResolvedValue({ ok: true, skipped: false, sent: 3, failed: 1, retrying: 2, rateLimited: false });
    const state = await drainQueueAction();
    expect(mocks.runManualDrain).toHaveBeenCalledWith({ actorId: "admin1" });
    expect(state.message).toBe("3 terkirim, 1 gagal, 2 akan dicoba ulang.");
    expect(state.error).toBeUndefined();
  });

  it("reports a drain that another process is already running", async () => {
    mocks.runManualDrain.mockResolvedValue({ ok: true, skipped: true });
    expect((await drainQueueAction()).message).toMatch(/proses lain/);
  });

  it.each(["DISABLED", "COOLDOWN", "FAILED"])("reports %s as an error", async (reason) => {
    mocks.runManualDrain.mockResolvedValue({ ok: false, reason });
    const state = await drainQueueAction();
    expect(state.error).toBeTruthy();
    expect(state.message).toBeUndefined();
  });
});
