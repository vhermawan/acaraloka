import { describe, expect, it } from "vitest";

import {
  ROLE_CONFLICT_MESSAGES,
  detectRoleConflict,
  homePathFor,
  loginPathFor,
  parseIntent,
  parseRole,
  resolveNewUserRole,
  resolvePostLoginPath,
} from "@/lib/roles";

describe("role conflict", () => {
  it("allows matching roles", () => {
    expect(detectRoleConflict("PARTICIPANT", "PARTICIPANT")).toBeNull();
    expect(detectRoleConflict("ORGANIZER", "ORGANIZER")).toBeNull();
  });

  it("flags a participant email used on the organizer page", () => {
    const conflict = detectRoleConflict("PARTICIPANT", "ORGANIZER");
    expect(conflict).toBe("role-participant");
    expect(ROLE_CONFLICT_MESSAGES[conflict!]).toBe(
      "Email ini terdaftar sebagai peserta. Gunakan email lain untuk akun panitia.",
    );
  });

  it("flags an organizer email used on the participant page", () => {
    const conflict = detectRoleConflict("ORGANIZER", "PARTICIPANT");
    expect(conflict).toBe("role-organizer");
    expect(ROLE_CONFLICT_MESSAGES[conflict!]).toContain("terdaftar sebagai panitia");
  });
});

describe("resolveNewUserRole", () => {
  it("creates organizer accounts only for an explicit organizer intent", () => {
    expect(resolveNewUserRole({ intent: "ORGANIZER" })).toBe("ORGANIZER");
    expect(resolveNewUserRole({ intent: "PARTICIPANT" })).toBe("PARTICIPANT");
    expect(resolveNewUserRole({ intent: "admin" })).toBe("PARTICIPANT");
    expect(resolveNewUserRole({})).toBe("PARTICIPANT");
    expect(resolveNewUserRole(null)).toBe("PARTICIPANT");
  });
});

describe("parsing", () => {
  it("defaults unknown values to participant", () => {
    expect(parseRole("ORGANIZER")).toBe("ORGANIZER");
    expect(parseRole("x")).toBe("PARTICIPANT");
    expect(parseRole(undefined)).toBe("PARTICIPANT");
    expect(parseIntent("organizer")).toBe("ORGANIZER");
    expect(parseIntent("participant")).toBe("PARTICIPANT");
    expect(parseIntent(null)).toBe("PARTICIPANT");
  });

  it("maps roles to login and home paths", () => {
    expect(loginPathFor("ORGANIZER")).toBe("/organizer/login");
    expect(loginPathFor("PARTICIPANT")).toBe("/login");
    expect(homePathFor("ORGANIZER")).toBe("/organizer");
    expect(homePathFor("PARTICIPANT")).toBe("/me/tickets");
  });
});

describe("resolvePostLoginPath", () => {
  it("sends organizers to the dashboard by default", () => {
    expect(resolvePostLoginPath("ORGANIZER", null, true)).toBe("/organizer");
    expect(resolvePostLoginPath("ORGANIZER", "/organizer/events/new", true)).toBe("/organizer/events/new");
  });

  it("ignores non-organizer next paths for organizers", () => {
    expect(resolvePostLoginPath("ORGANIZER", "/me/tickets", true)).toBe("/organizer");
    expect(resolvePostLoginPath("ORGANIZER", "//evil.com", true)).toBe("/organizer");
    expect(resolvePostLoginPath("ORGANIZER", "https://evil.com", true)).toBe("/organizer");
  });

  it("sends organizers without a profile to registration and keeps the target", () => {
    expect(resolvePostLoginPath("ORGANIZER", "/organizer/events/new", false)).toBe(
      `/organizer/register?next=${encodeURIComponent("/organizer/events/new")}`,
    );
  });

  it("sends participants to the origin page or their tickets", () => {
    expect(resolvePostLoginPath("PARTICIPANT", undefined, true)).toBe("/me/tickets");
    expect(resolvePostLoginPath("PARTICIPANT", "/e/abc/register", true)).toBe("/e/abc/register");
    expect(resolvePostLoginPath("PARTICIPANT", "/\t/evil.com", true)).toBe("/me/tickets");
    expect(resolvePostLoginPath("ORGANIZER", "/organizer/\t/x", true)).toBe("/organizer");
    expect(resolvePostLoginPath("PARTICIPANT", "//evil.com", true)).toBe("/me/tickets");
    expect(resolvePostLoginPath("PARTICIPANT", "/organizer/events", true)).toBe("/me/tickets");
  });
});
