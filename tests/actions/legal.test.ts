import { beforeEach, describe, expect, it, vi } from "vitest";

import { TERMS_VERSION } from "@/lib/legal";

const mocks = vi.hoisted(() => ({
  recordError: vi.fn(async () => undefined),
  getSession: vi.fn(),
  update: vi.fn(),
}));

vi.mock("next/navigation", async () => (await import("../mocks/next-navigation")).nextNavigationMock);
vi.mock("@/server/error-log", () => ({ recordError: mocks.recordError }));
vi.mock("@/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/server/db", () => ({ prisma: { user: { update: mocks.update } } }));

const { acceptTerms } = await import("@/actions/legal");

function form(next?: string) {
  const data = new FormData();
  if (next) data.set("next", next);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.update.mockReset();
  mocks.getSession.mockResolvedValue({ user: { id: "u1", disabledAt: null } });
});

describe("acceptTerms", () => {
  it("redirects to login without a session", async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(acceptTerms(form())).rejects.toThrow("REDIRECT:/login");
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.recordError).not.toHaveBeenCalled();
  });

  it("refuses a disabled account", async () => {
    mocks.getSession.mockResolvedValue({ user: { id: "u1", disabledAt: new Date() } });
    await expect(acceptTerms(form())).rejects.toThrow("REDIRECT:/login?error=disabled");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("stores the current terms version for the session user and redirects to a safe path", async () => {
    await expect(acceptTerms(form("/me/tickets"))).rejects.toThrow("REDIRECT:/me/tickets");
    expect(mocks.update.mock.calls[0][0]).toMatchObject({ where: { id: "u1" }, data: { termsVersion: TERMS_VERSION } });
    expect(mocks.recordError).not.toHaveBeenCalled();
  });

  it("ignores an unsafe redirect target", async () => {
    await expect(acceptTerms(form("https://evil.test"))).rejects.toThrow(/^REDIRECT:\/(?!\/)/);
  });

  it("records an unexpected failure and rethrows it so the error page shows", async () => {
    const failure = new Error("db down");
    mocks.update.mockRejectedValue(failure);
    await expect(acceptTerms(form())).rejects.toBe(failure);
    expect(mocks.recordError).toHaveBeenCalledWith({ source: "action.acceptTerms", error: failure });
  });
});
