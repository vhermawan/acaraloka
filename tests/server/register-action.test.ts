import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  createRegistration: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/server/authz", () => ({ requireUser: mocks.requireUser, canRegisterFreeTicket: () => true }));
vi.mock("@/server/public-event", () => ({ getPublicEvent: vi.fn() }));
vi.mock("@/server/email-schedule", () => ({ scheduleEmailDrain: vi.fn() }));
vi.mock("@/server/registration", () => ({ createRegistration: mocks.createRegistration }));
vi.mock("@/server/registration-form", () => ({ getRegistrationFields: vi.fn() }));

const { registerForEvent } = await import("@/app/e/[slug]/register/actions");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("registerForEvent", () => {
  it("rejects organizer accounts before touching registration", async () => {
    mocks.requireUser.mockResolvedValue({ id: "u1", role: "ORGANIZER", emailVerified: true });
    const state = await registerForEvent("abc", {}, new FormData());
    expect(state.message).toBe("Akun panitia tidak bisa mendaftar acara. Masuk dengan akun peserta.");
    expect(mocks.createRegistration).not.toHaveBeenCalled();
  });
});
