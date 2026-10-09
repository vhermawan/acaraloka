import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  disableEvent: vi.fn(),
  enableEvent: vi.fn(),
  listAdminEvents: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/authz", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/server/admin-events", () => ({
  disableEvent: mocks.disableEvent,
  enableEvent: mocks.enableEvent,
  listAdminEvents: mocks.listAdminEvents,
}));

const { disableEventAction, enableEventAction } = await import("@/app/admin/events/actions");
const { default: AdminEventsPage } = await import("@/app/admin/events/page");

function form(reason: string) {
  const data = new FormData();
  data.set("reason", reason);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin events authorization", () => {
  it("blocks the list page for non-admins", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(AdminEventsPage({ searchParams: Promise.resolve({}) } as never)).rejects.toThrow("NOT_FOUND");
    expect(mocks.listAdminEvents).not.toHaveBeenCalled();
  });

  it("blocks disabling for non-admins", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(disableEventAction("e1", {}, form("Melanggar aturan"))).rejects.toThrow("NOT_FOUND");
    expect(mocks.disableEvent).not.toHaveBeenCalled();
  });

  it("blocks enabling for non-admins", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(enableEventAction("e1")).rejects.toThrow("NOT_FOUND");
    expect(mocks.enableEvent).not.toHaveBeenCalled();
  });
});

describe("disableEventAction", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockResolvedValue({ id: "admin1", role: "ADMIN" });
  });

  it("requires a reason", async () => {
    const state = await disableEventAction("e1", {}, form("  "));
    expect(state.error).toBeTruthy();
    expect(mocks.disableEvent).not.toHaveBeenCalled();
  });

  it("passes the trimmed reason and admin to the server function", async () => {
    mocks.disableEvent.mockResolvedValue({ ok: true, slug: "s" });
    expect(await disableEventAction("e1", {}, form(" Melanggar aturan "))).toEqual({ done: true });
    expect(mocks.disableEvent).toHaveBeenCalledWith({ eventId: "e1", actorId: "admin1", reason: "Melanggar aturan" });
  });

  it("reports an already disabled event", async () => {
    mocks.disableEvent.mockResolvedValue({ ok: false, reason: "ALREADY_DISABLED" });
    const state = await disableEventAction("e1", {}, form("Melanggar aturan"));
    expect(state.error).toBe("Acara ini sudah dinonaktifkan.");
  });
});
