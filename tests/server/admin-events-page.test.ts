import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recordError: vi.fn(async () => undefined),
  requireAdmin: vi.fn(),
  disableEvent: vi.fn(),
  enableEvent: vi.fn(),
  listAdminEvents: vi.fn(),
}));

vi.mock("next/navigation", async () => (await import("../mocks/next-navigation")).nextNavigationMock);
vi.mock("@/server/error-log", () => ({ recordError: mocks.recordError }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/authz", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/server/admin-events", () => ({
  disableEvent: mocks.disableEvent,
  enableEvent: mocks.enableEvent,
  listAdminEvents: mocks.listAdminEvents,
}));

const { default: AdminEventsPage } = await import("@/app/admin/events/page");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin events authorization", () => {
  it("blocks the list page for non-admins", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(AdminEventsPage({ searchParams: Promise.resolve({}) } as never)).rejects.toThrow("NOT_FOUND");
    expect(mocks.listAdminEvents).not.toHaveBeenCalled();
  });
});
