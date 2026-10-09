import { beforeEach, describe, expect, it, vi } from "vitest";

import { TERMS_VERSION } from "@/lib/legal";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  signOut: vi.fn(),
  findProfile: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.getSession, signOut: mocks.signOut } } }));
vi.mock("@/server/db", () => ({ prisma: { organizerProfile: { findUnique: mocks.findProfile } } }));

const { GET } = await import("@/app/auth/continue/route");

function sessionFor(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      id: "u1",
      role: "PARTICIPANT",
      disabledAt: null,
      termsVersion: TERMS_VERSION,
      termsAcceptedAt: new Date(),
      ...overrides,
    },
  };
}

function request(query: string) {
  return { nextUrl: new URL(`http://x/auth/continue?${query}`) } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /auth/continue", () => {
  it("rejects a participant email on the organizer page, signs out, and returns to organizer login", async () => {
    mocks.getSession.mockResolvedValue(sessionFor({ role: "PARTICIPANT" }));
    await expect(GET(request("intent=organizer"))).rejects.toThrow(
      "REDIRECT:/organizer/login?error=role-participant",
    );
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  });

  it("rejects an organizer email on the participant page, signs out, and returns to login", async () => {
    mocks.getSession.mockResolvedValue(sessionFor({ role: "ORGANIZER" }));
    await expect(GET(request("intent=participant"))).rejects.toThrow("REDIRECT:/login?error=role-organizer");
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  });

  it("treats a missing intent as participant", async () => {
    mocks.getSession.mockResolvedValue(sessionFor({ role: "ORGANIZER" }));
    await expect(GET(request(""))).rejects.toThrow("REDIRECT:/login?error=role-organizer");
  });

  it("sends participants to their tickets or the origin page", async () => {
    mocks.getSession.mockResolvedValue(sessionFor());
    await expect(GET(request("intent=participant"))).rejects.toThrow("REDIRECT:/me/tickets");
    await expect(GET(request("intent=participant&next=%2Fe%2Fabc%2Fregister"))).rejects.toThrow(
      "REDIRECT:/e/abc/register",
    );
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("sends organizers with a profile to the dashboard", async () => {
    mocks.getSession.mockResolvedValue(sessionFor({ role: "ORGANIZER" }));
    mocks.findProfile.mockResolvedValue({ userId: "u1" });
    await expect(GET(request("intent=organizer"))).rejects.toThrow("REDIRECT:/organizer");
  });

  it("sends new organizers without a profile to registration, never leaving them as participants", async () => {
    mocks.getSession.mockResolvedValue(sessionFor({ role: "ORGANIZER" }));
    mocks.findProfile.mockResolvedValue(null);
    await expect(GET(request("intent=organizer&next=%2Forganizer%2Fevents%2Fnew"))).rejects.toThrow(
      `REDIRECT:/organizer/register?next=${encodeURIComponent("/organizer/events/new")}`,
    );
  });

  it("asks for terms before continuing", async () => {
    mocks.getSession.mockResolvedValue(sessionFor({ termsAcceptedAt: null, termsVersion: null }));
    await expect(GET(request("intent=participant"))).rejects.toThrow(
      `REDIRECT:/legal/accept?next=${encodeURIComponent("/me/tickets")}`,
    );
  });

  it("returns to the matching login page without a session or for disabled accounts", async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(GET(request("intent=organizer"))).rejects.toThrow("REDIRECT:/organizer/login");
    mocks.getSession.mockResolvedValue(sessionFor({ disabledAt: new Date() }));
    await expect(GET(request("intent=participant"))).rejects.toThrow("REDIRECT:/login?error=disabled");
  });
});
