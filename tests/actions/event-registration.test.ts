import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recordError: vi.fn(async () => undefined),
  requireUser: vi.fn(),
  createRegistration: vi.fn(),
}));

vi.mock("next/navigation", async () => (await import("../mocks/next-navigation")).nextNavigationMock);
vi.mock("@/server/error-log", () => ({ recordError: mocks.recordError }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/flash", () => ({ setFlash: vi.fn() }));
vi.mock("@/server/authz", () => ({ requireUser: mocks.requireUser, canRegisterFreeTicket: () => true }));
vi.mock("@/server/public-event", () => ({ getPublicEvent: vi.fn() }));
vi.mock("@/server/email-schedule", () => ({ scheduleEmailDrain: vi.fn() }));
vi.mock("@/server/registration", () => ({ createRegistration: mocks.createRegistration }));
vi.mock("@/server/registration-form", () => ({ getRegistrationFields: vi.fn() }));

const { registerForEvent } = await import("@/actions/event-registration");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("registerForEvent", () => {
  it.each(["ORGANIZER", "ADMIN"])("rejects %s accounts before touching registration", async (role) => {
    mocks.requireUser.mockResolvedValue({ id: "u1", role, emailVerified: true });
    const state = await registerForEvent("abc", {}, new FormData());
    expect(state.message).toBe("Akun ini tidak bisa mendaftar acara. Masuk dengan akun peserta.");
    expect(mocks.createRegistration).not.toHaveBeenCalled();
  });
});
