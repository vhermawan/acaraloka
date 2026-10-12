import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recordError: vi.fn(async () => undefined),
  requireEventOwner: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  deleteMany: vi.fn(),
  transaction: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", async () => (await import("../mocks/next-navigation")).nextNavigationMock);
vi.mock("@/server/error-log", () => ({ recordError: mocks.recordError }));
vi.mock("@/server/authz", () => ({ requireEventOwner: mocks.requireEventOwner }));
vi.mock("@/server/db", () => ({
  prisma: {
    formField: {
      findFirst: mocks.findFirst,
      findMany: mocks.findMany,
      create: mocks.create,
      update: mocks.update,
      updateMany: mocks.updateMany,
      deleteMany: mocks.deleteMany,
    },
    $transaction: mocks.transaction,
  },
}));

const { ACTION_ERROR_MESSAGE } = await import("@/actions/_lib/handle-action-error");
const { createFormField, updateFormField, deleteFormField, moveFormField } = await import("@/actions/event-form");

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const valid = { label: "Asal kampus", type: "TEXT", options: "", required: "on" };
const values = { label: "Asal kampus", type: "TEXT", options: "", required: "on" };
const draft = { event: { id: "e1", status: "DRAFT" } };

beforeEach(() => {
  vi.clearAllMocks();
  for (const mock of [mocks.findFirst, mocks.findMany, mocks.create, mocks.update, mocks.updateMany, mocks.deleteMany, mocks.transaction]) {
    mock.mockReset();
  }
  mocks.requireEventOwner.mockResolvedValue(draft);
});

describe("form field actions for non-owners", () => {
  it("rethrow the guard signal and change nothing", async () => {
    mocks.requireEventOwner.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(createFormField("e1", {}, form(valid))).rejects.toThrow("NOT_FOUND");
    await expect(updateFormField("e1", "f1", {}, form(valid))).rejects.toThrow("NOT_FOUND");
    await expect(deleteFormField("e1", "f1")).rejects.toThrow("NOT_FOUND");
    await expect(moveFormField("e1", "f1", "up")).rejects.toThrow("NOT_FOUND");
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.deleteMany).not.toHaveBeenCalled();
    expect(mocks.recordError).not.toHaveBeenCalled();
  });
});

describe("createFormField", () => {
  it("appends the field after the last one", async () => {
    mocks.findFirst.mockResolvedValue({ order: 4 });
    expect((await createFormField("e1", {}, form(valid))).savedAt).toBeDefined();
    expect(mocks.create.mock.calls[0][0].data).toMatchObject({ label: "Asal kampus", eventId: "e1", order: 5, required: true });
  });

  it("refuses closed events", async () => {
    mocks.requireEventOwner.mockResolvedValue({ event: { id: "e1", status: "CANCELLED" } });
    const result = await createFormField("e1", {}, form(valid));
    expect(result.message).toBe("Formulir acara ini tidak bisa diubah.");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("returns field errors and the typed values", async () => {
    const result = await createFormField("e1", {}, form({ ...valid, label: "x" }));
    expect(result.errors?.label?.length).toBeGreaterThan(0);
    expect(result.values?.label).toBe("x");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("returns a friendly message with the typed values and records an unexpected failure", async () => {
    const failure = new Error("db down");
    mocks.findFirst.mockRejectedValue(failure);
    expect(await createFormField("e1", {}, form(valid))).toEqual({ message: ACTION_ERROR_MESSAGE, values });
    expect(mocks.recordError).toHaveBeenCalledWith({ source: "action.createFormField", error: failure });
  });
});

describe("updateFormField", () => {
  it("updates only fields of the guarded event", async () => {
    const result = await updateFormField("e1", "f1", {}, form(valid));
    expect(result.savedAt).toBeDefined();
    expect(mocks.updateMany.mock.calls[0][0].where).toEqual({ id: "f1", eventId: "e1" });
  });

  it("returns field errors when validation fails", async () => {
    const result = await updateFormField("e1", "f1", {}, form({ ...valid, label: "" }));
    expect(result.errors?.label?.length).toBeGreaterThan(0);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("refuses closed events", async () => {
    mocks.requireEventOwner.mockResolvedValue({ event: { id: "e1", status: "DISABLED" } });
    expect((await updateFormField("e1", "f1", {}, form(valid))).message).toBe("Formulir acara ini tidak bisa diubah.");
  });

  it("returns a friendly message and records an unexpected failure", async () => {
    const failure = new Error("db down");
    mocks.updateMany.mockRejectedValue(failure);
    expect(await updateFormField("e1", "f1", {}, form(valid))).toEqual({ message: ACTION_ERROR_MESSAGE, values });
    expect(mocks.recordError).toHaveBeenCalledWith({ source: "action.updateFormField", error: failure });
  });
});

describe("deleteFormField", () => {
  it("deletes scoped to the guarded event", async () => {
    await deleteFormField("e1", "f1");
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { id: "f1", eventId: "e1" } });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/organizer/events/e1/form");
  });

  it("does nothing on closed events", async () => {
    mocks.requireEventOwner.mockResolvedValue({ event: { id: "e1", status: "CANCELLED" } });
    await deleteFormField("e1", "f1");
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it("records an unexpected failure and rethrows it", async () => {
    const failure = new Error("db down");
    mocks.deleteMany.mockRejectedValue(failure);
    await expect(deleteFormField("e1", "f1")).rejects.toBe(failure);
    expect(mocks.recordError).toHaveBeenCalledWith({ source: "action.deleteFormField", error: failure });
  });
});

describe("moveFormField", () => {
  const fields = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("swaps the field with its neighbour in one transaction", async () => {
    mocks.findMany.mockResolvedValue(fields);
    mocks.update.mockImplementation((args: unknown) => args);
    mocks.transaction.mockResolvedValue(undefined);
    await moveFormField("e1", "b", "up");
    expect(mocks.transaction).toHaveBeenCalledWith([
      { where: { id: "b" }, data: { order: 0 } },
      { where: { id: "a" }, data: { order: 1 } },
      { where: { id: "c" }, data: { order: 2 } },
    ]);
  });

  it("does nothing at the edges or for an unknown field", async () => {
    mocks.findMany.mockResolvedValue(fields);
    await moveFormField("e1", "a", "up");
    await moveFormField("e1", "c", "down");
    await moveFormField("e1", "zzz", "down");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("does nothing on closed events", async () => {
    mocks.requireEventOwner.mockResolvedValue({ event: { id: "e1", status: "CANCELLED" } });
    await moveFormField("e1", "b", "up");
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("records an unexpected failure and rethrows it", async () => {
    const failure = new Error("db down");
    mocks.findMany.mockRejectedValue(failure);
    await expect(moveFormField("e1", "b", "up")).rejects.toBe(failure);
    expect(mocks.recordError).toHaveBeenCalledWith({ source: "action.moveFormField", error: failure });
  });
});
