import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recordError: vi.fn(async () => undefined),
  requireEventOwner: vi.fn(),
  checkIn: vi.fn(),
  undoCheckIn: vi.fn(),
  searchCheckInParticipants: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", async () => (await import("../mocks/next-navigation")).nextNavigationMock);
vi.mock("@/server/error-log", () => ({ recordError: mocks.recordError }));
vi.mock("@/server/authz", () => ({ requireEventOwner: mocks.requireEventOwner }));
vi.mock("@/server/checkin", () => ({
  checkIn: mocks.checkIn,
  undoCheckIn: mocks.undoCheckIn,
  searchCheckInParticipants: mocks.searchCheckInParticipants,
}));

const { ACTION_ERROR_MESSAGE } = await import("@/actions/_lib/handle-action-error");
const { checkInByCode, checkInByRegistration, undoParticipantCheckIn, searchParticipants } = await import(
  "@/actions/event-checkin"
);

const CODE = "abcdefghijklmnopqrstuvwxyz";

beforeEach(() => {
  vi.clearAllMocks();
  for (const mock of [mocks.checkIn, mocks.undoCheckIn, mocks.searchCheckInParticipants]) mock.mockReset();
  mocks.requireEventOwner.mockResolvedValue({ user: { id: "u1" }, event: { id: "e1" } });
});

describe("check-in actions for non-owners", () => {
  it("rethrow the guard signal and change nothing", async () => {
    mocks.requireEventOwner.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(checkInByCode("e1", CODE)).rejects.toThrow("NOT_FOUND");
    await expect(checkInByRegistration("e1", "r1")).rejects.toThrow("NOT_FOUND");
    await expect(undoParticipantCheckIn("e1", "r1")).rejects.toThrow("NOT_FOUND");
    await expect(searchParticipants("e1", "budi")).rejects.toThrow("NOT_FOUND");
    expect(mocks.checkIn).not.toHaveBeenCalled();
    expect(mocks.undoCheckIn).not.toHaveBeenCalled();
    expect(mocks.recordError).not.toHaveBeenCalled();
  });
});

describe("checkInByCode", () => {
  it("answers INVALID for a malformed code without querying", async () => {
    expect(await checkInByCode("e1", "bukan-kode")).toEqual({ outcome: "INVALID", participant: null });
    expect(mocks.checkIn).not.toHaveBeenCalled();
  });

  it("checks in with the guarded event and actor, and revalidates on VALID", async () => {
    mocks.checkIn.mockResolvedValue({ outcome: "VALID", participant: null });
    expect((await checkInByCode("e1", ` ${CODE.toUpperCase()} `)).outcome).toBe("VALID");
    expect(mocks.checkIn).toHaveBeenCalledWith({ eventId: "e1", actorId: "u1", target: { ticketCode: CODE } });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/organizer/events/e1/checkin");
  });

  it("does not revalidate for other outcomes", async () => {
    mocks.checkIn.mockResolvedValue({ outcome: "ALREADY_CHECKED_IN", participant: null });
    await checkInByCode("e1", CODE);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("records an unexpected failure and rethrows it so the console shows its connection error", async () => {
    const failure = new Error("db down");
    mocks.checkIn.mockRejectedValue(failure);
    await expect(checkInByCode("e1", CODE)).rejects.toBe(failure);
    expect(mocks.recordError).toHaveBeenCalledWith({ source: "action.checkInByCode", error: failure });
  });
});

describe("checkInByRegistration", () => {
  it("checks in by registration id", async () => {
    mocks.checkIn.mockResolvedValue({ outcome: "VALID", participant: null });
    await checkInByRegistration("e1", "r1");
    expect(mocks.checkIn).toHaveBeenCalledWith({ eventId: "e1", actorId: "u1", target: { registrationId: "r1" } });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/organizer/events/e1/participants");
  });

  it("records an unexpected failure and rethrows it", async () => {
    const failure = new Error("db down");
    mocks.checkIn.mockRejectedValue(failure);
    await expect(checkInByRegistration("e1", "r1")).rejects.toBe(failure);
    expect(mocks.recordError).toHaveBeenCalledWith({ source: "action.checkInByRegistration", error: failure });
  });
});

describe("undoParticipantCheckIn", () => {
  it("undoes and revalidates", async () => {
    mocks.undoCheckIn.mockResolvedValue(true);
    expect(await undoParticipantCheckIn("e1", "r1")).toEqual({});
    expect(mocks.undoCheckIn).toHaveBeenCalledWith({ eventId: "e1", registrationId: "r1", actorId: "u1" });
    expect(mocks.revalidatePath).toHaveBeenCalled();
  });

  it("reports a check-in that cannot be undone", async () => {
    mocks.undoCheckIn.mockResolvedValue(false);
    expect((await undoParticipantCheckIn("e1", "r1")).error).toMatch(/tidak bisa dibatalkan/);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns a friendly error and records an unexpected failure", async () => {
    const failure = new Error("db down");
    mocks.undoCheckIn.mockRejectedValue(failure);
    expect(await undoParticipantCheckIn("e1", "r1")).toEqual({ error: ACTION_ERROR_MESSAGE });
    expect(mocks.recordError).toHaveBeenCalledWith({ source: "action.undoParticipantCheckIn", error: failure });
  });
});

describe("searchParticipants", () => {
  it("returns nothing for queries shorter than 2 characters", async () => {
    expect(await searchParticipants("e1", " b ")).toEqual([]);
    expect(mocks.searchCheckInParticipants).not.toHaveBeenCalled();
  });

  it("searches the guarded event with a trimmed, capped query", async () => {
    mocks.searchCheckInParticipants.mockResolvedValue([{ registrationId: "r1" }]);
    expect(await searchParticipants("e1", `  ${"b".repeat(150)} `)).toEqual([{ registrationId: "r1" }]);
    expect(mocks.searchCheckInParticipants).toHaveBeenCalledWith("e1", "b".repeat(100));
  });

  it("records an unexpected failure and rethrows it", async () => {
    const failure = new Error("db down");
    mocks.searchCheckInParticipants.mockRejectedValue(failure);
    await expect(searchParticipants("e1", "budi")).rejects.toBe(failure);
    expect(mocks.recordError).toHaveBeenCalledWith({ source: "action.searchParticipants", error: failure });
  });
});
