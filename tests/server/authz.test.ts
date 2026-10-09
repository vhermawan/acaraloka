import { beforeEach, describe, expect, it, vi } from "vitest";

import { TERMS_VERSION } from "@/lib/legal";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  findOrganizer: vi.fn(),
  findEvent: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/server/db", () => ({
  prisma: {
    organizerProfile: { findUnique: mocks.findOrganizer },
    event: { findUnique: mocks.findEvent },
  },
}));

const { requireUser, requireParticipant, requireOrganizer, requireEventOwner, requireAdmin, canRegisterFreeTicket } =
  await import("@/server/authz");

function sessionFor(overrides: Record<string, unknown> = {}) {
  return {
    session: { id: "s1" },
    user: {
      id: "u1",
      emailVerified: true,
      isAdmin: false,
      role: "ORGANIZER",
      disabledAt: null,
      termsVersion: TERMS_VERSION,
      termsAcceptedAt: new Date(),
      ...overrides,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireUser", () => {
  it("redirects to login without session", async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(requireUser()).rejects.toThrow("REDIRECT:/login");
  });

  it("redirects disabled users", async () => {
    mocks.getSession.mockResolvedValue(sessionFor({ disabledAt: new Date() }));
    await expect(requireUser()).rejects.toThrow("REDIRECT:/login?error=disabled");
  });

  it("keeps organizer logins on the organizer page when disabled", async () => {
    mocks.getSession.mockResolvedValue(sessionFor({ disabledAt: new Date() }));
    await expect(requireUser({ loginPath: "/organizer/login" })).rejects.toThrow(
      "REDIRECT:/organizer/login?error=disabled",
    );
  });

  it("redirects to terms when not accepted", async () => {
    mocks.getSession.mockResolvedValue(sessionFor({ termsAcceptedAt: null, termsVersion: null }));
    await expect(requireUser()).rejects.toThrow("REDIRECT:/legal/accept");
  });

  it("redirects to terms when accepted version is outdated", async () => {
    mocks.getSession.mockResolvedValue(sessionFor({ termsVersion: "2000-01-01" }));
    await expect(requireUser()).rejects.toThrow("REDIRECT:/legal/accept");
  });

  it("returns the user when valid", async () => {
    mocks.getSession.mockResolvedValue(sessionFor());
    await expect(requireUser()).resolves.toMatchObject({ id: "u1" });
  });
});

describe("requireParticipant", () => {
  it("redirects organizer accounts to the dashboard", async () => {
    mocks.getSession.mockResolvedValue(sessionFor({ role: "ORGANIZER" }));
    await expect(requireParticipant()).rejects.toThrow("REDIRECT:/organizer");
  });

  it("returns the user for participant accounts", async () => {
    mocks.getSession.mockResolvedValue(sessionFor({ role: "PARTICIPANT" }));
    await expect(requireParticipant()).resolves.toMatchObject({ id: "u1" });
  });

  it("sends anonymous visitors to the participant login", async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(requireParticipant({ next: "/me/tickets" })).rejects.toThrow("REDIRECT:/login?next=");
  });
});

describe("requireOrganizer", () => {
  it("sends anonymous visitors to the organizer login", async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(requireOrganizer()).rejects.toThrow("REDIRECT:/organizer/login");
  });

  it("rejects participant accounts with a role conflict", async () => {
    mocks.getSession.mockResolvedValue(sessionFor({ role: "PARTICIPANT" }));
    await expect(requireOrganizer()).rejects.toThrow("REDIRECT:/organizer/login?error=role-participant");
    expect(mocks.findOrganizer).not.toHaveBeenCalled();
  });

  it("redirects to organizer registration without a profile", async () => {
    mocks.getSession.mockResolvedValue(sessionFor());
    mocks.findOrganizer.mockResolvedValue(null);
    await expect(requireOrganizer()).rejects.toThrow("REDIRECT:/organizer/register");
  });

  it("returns organizer when profile exists", async () => {
    mocks.getSession.mockResolvedValue(sessionFor());
    mocks.findOrganizer.mockResolvedValue({ userId: "u1" });
    await expect(requireOrganizer()).resolves.toMatchObject({ organizer: { userId: "u1" } });
  });
});

describe("requireEventOwner", () => {
  beforeEach(() => {
    mocks.getSession.mockResolvedValue(sessionFor());
    mocks.findOrganizer.mockResolvedValue({ userId: "u1" });
  });

  it("404s for missing event", async () => {
    mocks.findEvent.mockResolvedValue(null);
    await expect(requireEventOwner("e1")).rejects.toThrow("NOT_FOUND");
  });

  it("404s for another organizer's event", async () => {
    mocks.findEvent.mockResolvedValue({ id: "e1", organizerId: "u2" });
    await expect(requireEventOwner("e1")).rejects.toThrow("NOT_FOUND");
  });

  it("returns event for owner", async () => {
    mocks.findEvent.mockResolvedValue({ id: "e1", organizerId: "u1" });
    await expect(requireEventOwner("e1")).resolves.toMatchObject({ event: { id: "e1" } });
  });
});

describe("requireAdmin", () => {
  it("404s for non-admin", async () => {
    mocks.getSession.mockResolvedValue(sessionFor({ isAdmin: false }));
    await expect(requireAdmin()).rejects.toThrow("NOT_FOUND");
  });

  it("returns admin user", async () => {
    mocks.getSession.mockResolvedValue(sessionFor({ isAdmin: true }));
    await expect(requireAdmin()).resolves.toMatchObject({ id: "u1" });
  });
});

describe("canRegisterFreeTicket", () => {
  it("requires verified email", () => {
    expect(canRegisterFreeTicket({ emailVerified: false })).toBe(false);
    expect(canRegisterFreeTicket({ emailVerified: true })).toBe(true);
  });
});
