import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getOAuthState: vi.fn() }));

vi.mock("better-auth/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("better-auth/api")>()),
  getOAuthState: mocks.getOAuthState,
}));

const { prepareNewUser } = await import("@/server/new-user");

const user = { id: "u1", email: "a@example.test", name: "A" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("prepareNewUser via OAuth", () => {
  it.each(["ADMIN", "admin"])("refuses to create an account for the %s intent", async (intent) => {
    mocks.getOAuthState.mockResolvedValue({ intent });
    await expect(prepareNewUser(user, { path: "/callback/:id" })).rejects.toMatchObject({
      body: { code: "ADMIN_SIGNUP_FORBIDDEN" },
      statusCode: 403,
    });
  });

  it("creates organizers and participants from their intent", async () => {
    mocks.getOAuthState.mockResolvedValue({ intent: "ORGANIZER" });
    await expect(prepareNewUser(user, { path: "/callback/:id" })).resolves.toMatchObject({
      data: { role: "ORGANIZER" },
    });
    mocks.getOAuthState.mockResolvedValue({ intent: "PARTICIPANT" });
    await expect(prepareNewUser(user, { path: "/callback/:id" })).resolves.toMatchObject({
      data: { role: "PARTICIPANT" },
    });
  });

  it("defaults to participant without state", async () => {
    mocks.getOAuthState.mockResolvedValue(null);
    await expect(prepareNewUser(user, undefined)).resolves.toMatchObject({ data: { role: "PARTICIPANT" } });
  });
});

describe("prepareNewUser via email sign-up", () => {
  it("refuses the admin intent without touching the OAuth state", async () => {
    await expect(
      prepareNewUser(user, { path: "/sign-up/email", body: { intent: "ADMIN" } }),
    ).rejects.toMatchObject({ body: { code: "ADMIN_SIGNUP_FORBIDDEN" } });
    expect(mocks.getOAuthState).not.toHaveBeenCalled();
  });

  it("assigns the role from the sign-up page and fixes the terms fields", async () => {
    const result = await prepareNewUser(user, { path: "/sign-up/email", body: { intent: "ORGANIZER" } });
    expect(result.data).toMatchObject({
      role: "ORGANIZER",
      disabledAt: null,
      termsAcceptedAt: expect.any(Date),
    });
  });
});
