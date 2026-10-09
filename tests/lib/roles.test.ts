import { describe, expect, it } from "vitest";

import {
  ROLE_CONFLICT_MESSAGES,
  detectRoleConflict,
  homePathFor,
  loginPathFor,
  parseIntent,
  adminLoginConflict,
  pageConflict,
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

describe("admin role conflict", () => {
  it("rejects admin accounts on the participant and organizer pages with a generic message", () => {
    expect(detectRoleConflict("ADMIN", "PARTICIPANT")).toBe("role-admin");
    expect(detectRoleConflict("ADMIN", "ORGANIZER")).toBe("role-admin");
    expect(ROLE_CONFLICT_MESSAGES["role-admin"]).not.toMatch(/admin/i);
  });

  it("rejects non-admin accounts on the admin page", () => {
    expect(detectRoleConflict("PARTICIPANT", "ADMIN")).toBe("role-not-admin");
    expect(detectRoleConflict("ORGANIZER", "ADMIN")).toBe("role-not-admin");
    expect(detectRoleConflict("ADMIN", "ADMIN")).toBeNull();
    expect(ROLE_CONFLICT_MESSAGES["role-not-admin"]).toBe("Akun ini tidak punya akses admin.");
  });
});

describe("pageConflict", () => {
  it("prefers the session role, then the error query", () => {
    expect(pageConflict("ADMIN", "PARTICIPANT", undefined)).toBe("role-admin");
    expect(pageConflict("PARTICIPANT", "ADMIN", "role-admin")).toBe("role-not-admin");
    expect(pageConflict(null, "ADMIN", "role-not-admin")).toBe("role-not-admin");
    expect(pageConflict("PARTICIPANT", "PARTICIPANT", "role-organizer")).toBe("role-organizer");
    expect(pageConflict(null, "PARTICIPANT", "bogus")).toBeNull();
  });
});

describe("adminLoginConflict", () => {
  it("shows the generic admin message for unknown OAuth error codes", () => {
    expect(adminLoginConflict(null, "unable_to_create_user", false)).toBe("role-not-admin");
    expect(adminLoginConflict(null, "ADMIN_SIGNUP_FORBIDDEN", false)).toBe("role-not-admin");
  });

  it("leaves known notices, disabled accounts and a clean page alone", () => {
    expect(adminLoginConflict(null, "verify-expired", true)).toBeNull();
    expect(adminLoginConflict(null, "disabled", false)).toBeNull();
    expect(adminLoginConflict(null, undefined, false)).toBeNull();
    expect(adminLoginConflict("PARTICIPANT", undefined, false)).toBe("role-not-admin");
  });
});

describe("resolveNewUserRole", () => {
  it("creates organizer accounts only for an explicit organizer intent", () => {
    expect(resolveNewUserRole("ORGANIZER")).toBe("ORGANIZER");
    expect(resolveNewUserRole("PARTICIPANT")).toBe("PARTICIPANT");
    expect(resolveNewUserRole("x")).toBe("PARTICIPANT");
    expect(resolveNewUserRole(undefined)).toBe("PARTICIPANT");
    expect(resolveNewUserRole(null)).toBe("PARTICIPANT");
  });

  it("never yields a role for an admin intent", () => {
    expect(resolveNewUserRole("ADMIN")).toBeNull();
    expect(resolveNewUserRole("admin")).toBeNull();
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
    expect(parseIntent("admin")).toBe("ADMIN");
    expect(parseIntent("ADMIN")).toBe("ADMIN");
    expect(parseRole("ADMIN")).toBe("ADMIN");
  });

  it("maps roles to login and home paths", () => {
    expect(loginPathFor("ORGANIZER")).toBe("/organizer/login");
    expect(loginPathFor("PARTICIPANT")).toBe("/login");
    expect(homePathFor("ORGANIZER")).toBe("/organizer");
    expect(homePathFor("PARTICIPANT")).toBe("/me/tickets");
    expect(loginPathFor("ADMIN")).toBe("/admin/login");
    expect(homePathFor("ADMIN")).toBe("/admin");
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

  it("keeps admins inside the admin area", () => {
    expect(resolvePostLoginPath("ADMIN", null, true)).toBe("/admin");
    expect(resolvePostLoginPath("ADMIN", "/admin/events", true)).toBe("/admin/events");
    expect(resolvePostLoginPath("ADMIN", "/admin/login", true)).toBe("/admin");
    expect(resolvePostLoginPath("ADMIN", "/me/tickets", true)).toBe("/admin");
    expect(resolvePostLoginPath("ADMIN", "//evil.com", true)).toBe("/admin");
  });

  it("never sends participants into the admin area", () => {
    expect(resolvePostLoginPath("PARTICIPANT", "/admin/events", true)).toBe("/me/tickets");
  });
});
