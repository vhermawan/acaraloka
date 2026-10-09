export const USER_ROLES = ["PARTICIPANT", "ORGANIZER"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export type RoleConflict = "role-participant" | "role-organizer";

export const ROLE_CONFLICT_MESSAGES: Record<RoleConflict, string> = {
  "role-participant": "Email ini terdaftar sebagai peserta. Gunakan email lain untuk akun panitia.",
  "role-organizer": "Email ini terdaftar sebagai panitia. Gunakan email lain untuk akun peserta.",
};

const LOGIN_PATHS: Record<UserRole, string> = {
  PARTICIPANT: "/login",
  ORGANIZER: "/organizer/login",
};

const HOME_PATHS: Record<UserRole, string> = {
  PARTICIPANT: "/me/tickets",
  ORGANIZER: "/organizer",
};

export function loginPathFor(role: UserRole) {
  return LOGIN_PATHS[role];
}

export function homePathFor(role: UserRole) {
  return HOME_PATHS[role];
}

export function parseRole(value: unknown): UserRole {
  return value === "ORGANIZER" ? "ORGANIZER" : "PARTICIPANT";
}

export function parseIntent(value: unknown): UserRole {
  return value === "organizer" || value === "ORGANIZER" ? "ORGANIZER" : "PARTICIPANT";
}

export function intentParam(role: UserRole) {
  return role === "ORGANIZER" ? "organizer" : "participant";
}

export function detectRoleConflict(accountRole: UserRole, intent: UserRole): RoleConflict | null {
  if (accountRole === intent) return null;
  return accountRole === "PARTICIPANT" ? "role-participant" : "role-organizer";
}

export function parseRoleConflict(value: unknown): RoleConflict | null {
  return value === "role-participant" || value === "role-organizer" ? value : null;
}

export function resolveNewUserRole(oauthState: Record<string, unknown> | null | undefined): UserRole {
  return parseRole(oauthState?.intent);
}

export function resolvePostLoginPath(role: UserRole, next: unknown, hasProfile: boolean) {
  const fallback = homePathFor(role);
  if (role === "ORGANIZER") {
    const path = typeof next === "string" && isOrganizerPath(next) ? next : fallback;
    return hasProfile ? path : `/organizer/register?next=${encodeURIComponent(path)}`;
  }
  const path = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
  return isOrganizerPath(path) ? fallback : path;
}

function isOrganizerPath(path: string) {
  return (
    (path === "/organizer" || path.startsWith("/organizer/") || path.startsWith("/organizer?")) &&
    !path.startsWith("//") &&
    !path.startsWith("/\\")
  );
}
