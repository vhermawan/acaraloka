import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn() }));

vi.mock("@/server/db", () => ({ prisma: { user: { findUnique: mocks.findUnique } } }));

const { rejectDisabledPasswordSignIn } = await import("@/server/session-guard");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("rejectDisabledPasswordSignIn", () => {
  it("refuses a password sign-in for a disabled user", async () => {
    mocks.findUnique.mockResolvedValue({ disabledAt: new Date() });
    await expect(rejectDisabledPasswordSignIn({ userId: "u1" }, { path: "/sign-in/email" })).rejects.toMatchObject({
      status: "FORBIDDEN",
      body: { code: "ACCOUNT_DISABLED" },
    });
  });

  it("lets active users through", async () => {
    mocks.findUnique.mockResolvedValue({ disabledAt: null });
    await expect(rejectDisabledPasswordSignIn({ userId: "u1" }, { path: "/sign-in/email" })).resolves.toBeUndefined();
  });

  it("does not touch other flows or look up the user", async () => {
    for (const path of ["/callback/:id", "/verify-email", undefined]) {
      await expect(rejectDisabledPasswordSignIn({ userId: "u1" }, path ? { path } : null)).resolves.toBeUndefined();
    }
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });
});
