import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recordError: vi.fn(async () => undefined),
  requireParticipant: vi.fn(),
  findFirst: vi.fn(),
  cancelRegistration: vi.fn(),
  updateRegistrationName: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", async () => (await import("../mocks/next-navigation")).nextNavigationMock);
vi.mock("@/server/error-log", () => ({ recordError: mocks.recordError }));
vi.mock("@/server/authz", () => ({ requireParticipant: mocks.requireParticipant }));
vi.mock("@/server/db", () => ({ prisma: { registration: { findFirst: mocks.findFirst } } }));
vi.mock("@/server/cancellation", () => ({ cancelRegistration: mocks.cancelRegistration }));
vi.mock("@/server/certificates", () => ({ updateRegistrationName: mocks.updateRegistrationName }));

const { ACTION_ERROR_MESSAGE } = await import("@/actions/_lib/handle-action-error");
const { cancelMyRegistration, renameMyRegistration } = await import("@/actions/my-tickets");

const upcoming = () => ({
  eventId: "e1",
  event: { slug: "acara", status: "PUBLISHED", endAt: new Date(Date.now() + 86_400_000) },
});

beforeEach(() => {
  vi.clearAllMocks();
  for (const mock of [mocks.findFirst, mocks.cancelRegistration, mocks.updateRegistrationName]) mock.mockReset();
  mocks.requireParticipant.mockResolvedValue({ id: "u1" });
});

describe("participant actions without a participant session", () => {
  it("rethrow the guard signal and change nothing", async () => {
    mocks.requireParticipant.mockRejectedValue(new Error("REDIRECT:/login"));
    await expect(cancelMyRegistration("r1")).rejects.toThrow("REDIRECT:/login");
    await expect(renameMyRegistration("r1", "Budi")).rejects.toThrow("REDIRECT:/login");
    expect(mocks.cancelRegistration).not.toHaveBeenCalled();
    expect(mocks.updateRegistrationName).not.toHaveBeenCalled();
    expect(mocks.recordError).not.toHaveBeenCalled();
  });
});

describe("cancelMyRegistration", () => {
  it("looks the registration up by the session user and cancels it", async () => {
    mocks.findFirst.mockResolvedValue(upcoming());
    mocks.cancelRegistration.mockResolvedValue({ ok: true });
    expect(await cancelMyRegistration("r1")).toEqual({});
    expect(mocks.findFirst.mock.calls[0][0].where).toEqual({ id: "r1", userId: "u1" });
    expect(mocks.cancelRegistration).toHaveBeenCalledWith({
      registrationId: "r1",
      eventId: "e1",
      actorId: "u1",
      reason: "Dibatalkan oleh peserta",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/e/acara");
  });

  it("refuses an unknown registration, a closed event, or one that already ended", async () => {
    mocks.findFirst.mockResolvedValueOnce(null);
    mocks.findFirst.mockResolvedValueOnce({ ...upcoming(), event: { ...upcoming().event, status: "CANCELLED" } });
    mocks.findFirst.mockResolvedValueOnce({ ...upcoming(), event: { ...upcoming().event, endAt: new Date(Date.now() - 1000) } });
    for (let i = 0; i < 3; i++) {
      expect(await cancelMyRegistration("r1")).toEqual({ error: "Pendaftaran ini tidak bisa dibatalkan." });
    }
    expect(mocks.cancelRegistration).not.toHaveBeenCalled();
  });

  it("reports a registration that cannot be cancelled", async () => {
    mocks.findFirst.mockResolvedValue(upcoming());
    mocks.cancelRegistration.mockResolvedValue({ ok: false });
    expect((await cancelMyRegistration("r1")).error).toMatch(/sudah check-in/);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns a friendly error and records an unexpected failure", async () => {
    const failure = new Error("db down");
    mocks.findFirst.mockRejectedValue(failure);
    expect(await cancelMyRegistration("r1")).toEqual({ error: ACTION_ERROR_MESSAGE });
    expect(mocks.recordError).toHaveBeenCalledWith({ source: "action.cancelMyRegistration", error: failure });
  });
});

describe("renameMyRegistration", () => {
  it("renames with the session user and revalidates", async () => {
    mocks.updateRegistrationName.mockResolvedValue({ ok: true });
    expect(await renameMyRegistration("r1", "  Budi Santoso ")).toEqual({});
    expect(mocks.updateRegistrationName).toHaveBeenCalledWith("u1", "r1", "Budi Santoso");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/me/tickets/r1");
  });

  it("rejects an invalid name before querying", async () => {
    expect((await renameMyRegistration("r1", "B")).error).toBe("Nama minimal 2 karakter.");
    expect(mocks.updateRegistrationName).not.toHaveBeenCalled();
  });

  it("reports a name that can no longer be changed", async () => {
    mocks.updateRegistrationName.mockResolvedValue({ ok: false });
    expect((await renameMyRegistration("r1", "Budi")).error).toMatch(/sertifikat sudah terbit/);
  });

  it("returns a friendly error and records an unexpected failure", async () => {
    const failure = new Error("db down");
    mocks.updateRegistrationName.mockRejectedValue(failure);
    expect(await renameMyRegistration("r1", "Budi")).toEqual({ error: ACTION_ERROR_MESSAGE });
    expect(mocks.recordError).toHaveBeenCalledWith({ source: "action.renameMyRegistration", error: failure });
  });
});
