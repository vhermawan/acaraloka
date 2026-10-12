import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recordError: vi.fn(async () => undefined),
  requireEventOwner: vi.fn(),
  create: vi.fn(),
  findFirst: vi.fn(),
  updateMany: vi.fn(),
  deleteMany: vi.fn(),
  countRegistrations: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", async () => (await import("../mocks/next-navigation")).nextNavigationMock);
vi.mock("@/server/error-log", () => ({ recordError: mocks.recordError }));
vi.mock("@/server/authz", () => ({ requireEventOwner: mocks.requireEventOwner }));
vi.mock("@/server/db", () => ({
  prisma: {
    ticketType: { create: mocks.create, findFirst: mocks.findFirst, updateMany: mocks.updateMany, deleteMany: mocks.deleteMany },
    registration: { count: mocks.countRegistrations },
  },
}));

const { ACTION_ERROR_MESSAGE } = await import("@/actions/_lib/handle-action-error");
const { createTicketType, updateTicketType, deleteTicketType } = await import("@/actions/event-tickets");

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const valid = { name: "Reguler", quota: "50" };
const draft = { event: { id: "e1", status: "DRAFT" } };

beforeEach(() => {
  vi.clearAllMocks();
  for (const mock of [mocks.create, mocks.findFirst, mocks.updateMany, mocks.deleteMany, mocks.countRegistrations]) mock.mockReset();
  mocks.requireEventOwner.mockResolvedValue(draft);
});

describe("ticket actions for non-owners", () => {
  it("rethrow the guard signal and change nothing", async () => {
    mocks.requireEventOwner.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(createTicketType("e1", {}, form(valid))).rejects.toThrow("NOT_FOUND");
    await expect(updateTicketType("e1", "t1", {}, form(valid))).rejects.toThrow("NOT_FOUND");
    await expect(deleteTicketType("e1", "t1")).rejects.toThrow("NOT_FOUND");
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.deleteMany).not.toHaveBeenCalled();
    expect(mocks.recordError).not.toHaveBeenCalled();
  });
});

describe("createTicketType", () => {
  it("creates a free ticket for the guarded event", async () => {
    const result = await createTicketType("e1", {}, form(valid));
    expect(result.savedAt).toBeDefined();
    expect(mocks.create).toHaveBeenCalledWith({ data: { name: "Reguler", quota: 50, price: 0, eventId: "e1" } });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/organizer/events/e1/tickets");
  });

  it("refuses closed events", async () => {
    mocks.requireEventOwner.mockResolvedValue({ event: { id: "e1", status: "CANCELLED" } });
    const result = await createTicketType("e1", {}, form(valid));
    expect(result.message).toBe("Tiket acara ini tidak bisa diubah.");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("returns field errors and the typed values", async () => {
    const result = await createTicketType("e1", {}, form({ name: "R", quota: "0" }));
    expect(result.errors?.name?.length).toBeGreaterThan(0);
    expect(result.errors?.quota?.length).toBeGreaterThan(0);
    expect(result.values).toEqual({ name: "R", quota: "0" });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("returns a friendly message with the typed values and records an unexpected failure", async () => {
    const failure = new Error("db down");
    mocks.create.mockRejectedValue(failure);
    expect(await createTicketType("e1", {}, form(valid))).toEqual({ message: ACTION_ERROR_MESSAGE, values: valid });
    expect(mocks.recordError).toHaveBeenCalledWith({ source: "action.createTicketType", error: failure });
  });
});

describe("updateTicketType", () => {
  it("updates a ticket of the guarded event", async () => {
    mocks.findFirst.mockResolvedValue({ id: "t1", reservedCount: 2 });
    mocks.updateMany.mockResolvedValue({ count: 1 });
    const result = await updateTicketType("e1", "t1", {}, form(valid));
    expect(result.savedAt).toBeDefined();
    expect(mocks.findFirst).toHaveBeenCalledWith({ where: { id: "t1", eventId: "e1" } });
  });

  it("reports an unknown ticket", async () => {
    mocks.findFirst.mockResolvedValue(null);
    expect((await updateTicketType("e1", "t1", {}, form(valid))).message).toBe("Tiket tidak ditemukan.");
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("refuses a quota below the reserved count", async () => {
    mocks.findFirst.mockResolvedValue({ id: "t1", reservedCount: 30 });
    mocks.updateMany.mockResolvedValue({ count: 0 });
    const result = await updateTicketType("e1", "t1", {}, form({ name: "Reguler", quota: "10" }));
    expect(result.errors?.quota?.[0]).toMatch(/30 tiket/);
  });

  it("returns field errors when validation fails", async () => {
    const result = await updateTicketType("e1", "t1", {}, form({ name: "", quota: "x" }));
    expect(result.errors).toBeDefined();
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("returns a friendly message and records an unexpected failure", async () => {
    const failure = new Error("db down");
    mocks.findFirst.mockRejectedValue(failure);
    expect(await updateTicketType("e1", "t1", {}, form(valid))).toEqual({ message: ACTION_ERROR_MESSAGE, values: valid });
    expect(mocks.recordError).toHaveBeenCalledWith({ source: "action.updateTicketType", error: failure });
  });
});

describe("deleteTicketType", () => {
  it("deletes a ticket without registrations, scoped to the guarded event", async () => {
    mocks.countRegistrations.mockResolvedValue(0);
    expect(await deleteTicketType("e1", "t1")).toEqual({});
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { id: "t1", eventId: "e1" } });
  });

  it("refuses a ticket that already has registrations", async () => {
    mocks.countRegistrations.mockResolvedValue(3);
    expect((await deleteTicketType("e1", "t1")).error).toMatch(/sudah punya pendaftar/);
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it("refuses closed events", async () => {
    mocks.requireEventOwner.mockResolvedValue({ event: { id: "e1", status: "DISABLED" } });
    expect((await deleteTicketType("e1", "t1")).error).toBe("Tiket acara ini tidak bisa diubah.");
  });

  it("returns a friendly error and records an unexpected failure", async () => {
    const failure = new Error("db down");
    mocks.countRegistrations.mockRejectedValue(failure);
    expect(await deleteTicketType("e1", "t1")).toEqual({ error: ACTION_ERROR_MESSAGE });
    expect(mocks.recordError).toHaveBeenCalledWith({ source: "action.deleteTicketType", error: failure });
  });
});
