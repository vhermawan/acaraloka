import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recordError: vi.fn(async () => undefined),
  requireUser: vi.fn(),
  canRegisterFreeTicket: vi.fn(),
  getPublicEvent: vi.fn(),
  getRegistrationFields: vi.fn(),
  createRegistration: vi.fn(),
  scheduleEmailDrain: vi.fn(),
  setFlash: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", async () => (await import("../mocks/next-navigation")).nextNavigationMock);
vi.mock("@/server/error-log", () => ({ recordError: mocks.recordError }));
vi.mock("@/server/flash", () => ({ setFlash: mocks.setFlash }));
vi.mock("@/server/authz", () => ({
  requireUser: mocks.requireUser,
  canRegisterFreeTicket: mocks.canRegisterFreeTicket,
}));
vi.mock("@/server/public-event", () => ({ getPublicEvent: mocks.getPublicEvent }));
vi.mock("@/server/email-schedule", () => ({ scheduleEmailDrain: mocks.scheduleEmailDrain }));
vi.mock("@/server/registration", () => ({ createRegistration: mocks.createRegistration }));
vi.mock("@/server/registration-form", () => ({ getRegistrationFields: mocks.getRegistrationFields }));

const { ACTION_ERROR_MESSAGE } = await import("@/actions/_lib/handle-action-error");
const { registerForEvent } = await import("@/actions/event-registration");

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const valid = {
  ticketTypeId: "t1",
  name: "Budi Santoso",
  email: "budi@kampus.test",
  phone: "081234567890",
  consent: "on",
};

beforeEach(() => {
  vi.clearAllMocks();
  for (const mock of [mocks.getPublicEvent, mocks.getRegistrationFields, mocks.createRegistration]) mock.mockReset();
  mocks.requireUser.mockResolvedValue({ id: "u1", role: "PARTICIPANT", emailVerified: true });
  mocks.canRegisterFreeTicket.mockReturnValue(true);
  mocks.getPublicEvent.mockResolvedValue({ id: "e1", ticketTypes: [{ id: "t1" }] });
  mocks.getRegistrationFields.mockResolvedValue([]);
});

describe("registerForEvent", () => {
  it("rethrows the login redirect without logging it", async () => {
    mocks.requireUser.mockRejectedValue(new Error("REDIRECT:/login?next=/e/abc/register"));
    await expect(registerForEvent("abc", {}, form(valid))).rejects.toThrow(/^REDIRECT:\/login/);
    expect(mocks.createRegistration).not.toHaveBeenCalled();
    expect(mocks.recordError).not.toHaveBeenCalled();
  });

  it.each(["ORGANIZER", "ADMIN"])("rejects %s accounts before touching registration", async (role) => {
    mocks.requireUser.mockResolvedValue({ id: "u1", role, emailVerified: true });
    const state = await registerForEvent("abc", {}, new FormData());
    expect(state.message).toBe("Akun ini tidak bisa mendaftar acara. Masuk dengan akun peserta.");
    expect(mocks.createRegistration).not.toHaveBeenCalled();
  });

  it("asks for email verification first", async () => {
    mocks.canRegisterFreeTicket.mockReturnValue(false);
    const state = await registerForEvent("abc", {}, form(valid));
    expect(state.message).toMatch(/Verifikasi email/);
    expect(mocks.getPublicEvent).not.toHaveBeenCalled();
  });

  it("reports an event that is not open", async () => {
    mocks.getPublicEvent.mockResolvedValue(null);
    expect((await registerForEvent("abc", {}, form(valid))).message).toBe("Pendaftaran acara ini sudah ditutup.");
  });

  it("returns field errors and the typed values when validation fails", async () => {
    const state = await registerForEvent("abc", {}, form({ ...valid, name: "" }));
    expect(state.errors?.name?.length).toBeGreaterThan(0);
    expect(state.values?.email).toBe("budi@kampus.test");
    expect(mocks.createRegistration).not.toHaveBeenCalled();
  });

  it("maps a sold out rejection to its message", async () => {
    mocks.createRegistration.mockResolvedValue({ ok: false, reason: "SOLD_OUT" });
    const state = await registerForEvent("abc", {}, form(valid));
    expect(state.message).toMatch(/kuota tiket ini baru saja habis/);
    expect(mocks.scheduleEmailDrain).not.toHaveBeenCalled();
  });

  it("registers the session user, schedules email and redirects to the ticket", async () => {
    mocks.createRegistration.mockResolvedValue({ ok: true, registrationId: "r1" });
    await expect(registerForEvent("abc", {}, form(valid))).rejects.toThrow("REDIRECT:/me/tickets/r1");
    expect(mocks.createRegistration).toHaveBeenCalledWith(expect.objectContaining({ eventId: "e1", userId: "u1" }));
    expect(mocks.setFlash).toHaveBeenCalledWith("registration-created");
    expect(mocks.scheduleEmailDrain).toHaveBeenCalled();
    expect(mocks.recordError).not.toHaveBeenCalled();
  });

  it("returns a friendly message with the typed values and records an unexpected failure", async () => {
    const failure = new Error("db down");
    mocks.createRegistration.mockRejectedValue(failure);
    const state = await registerForEvent("abc", {}, form(valid));
    expect(state).toEqual({ message: ACTION_ERROR_MESSAGE, values: valid });
    expect(mocks.recordError).toHaveBeenCalledWith({ source: "action.registerForEvent", error: failure });
  });
});
