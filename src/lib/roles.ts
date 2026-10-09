import { isSafeRedirectPath } from "@/lib/safe-redirect";

export const USER_ROLES = ["PARTICIPANT", "ORGANIZER", "ADMIN"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export type SelfServeRole = Exclude<UserRole, "ADMIN">;

export type RoleConflict = "role-participant" | "role-organizer" | "role-admin" | "role-not-admin";

export const ROLE_CONFLICT_MESSAGES: Record<RoleConflict, string> = {
  "role-participant": "Email ini terdaftar sebagai peserta. Gunakan email lain untuk akun panitia.",
  "role-organizer": "Email ini terdaftar sebagai panitia. Gunakan email lain untuk akun peserta.",
  "role-admin": "Akun ini tidak bisa dipakai di halaman ini.",
  "role-not-admin": "Akun ini tidak punya akses admin.",
};

const LOGIN_PATHS: Record<UserRole, string> = {
  PARTICIPANT: "/login",
  ORGANIZER: "/organizer/login",
  ADMIN: "/admin/login",
};

const HOME_PATHS: Record<UserRole, string> = {
  PARTICIPANT: "/me/tickets",
  ORGANIZER: "/organizer",
  ADMIN: "/admin",
};

export function loginPathFor(role: UserRole) {
  return LOGIN_PATHS[role];
}

export function homePathFor(role: UserRole) {
  return HOME_PATHS[role];
}

export function parseRole(value: unknown): UserRole {
  if (value === "ORGANIZER" || value === "ADMIN") return value;
  return "PARTICIPANT";
}

export function parseIntent(value: unknown): UserRole {
  if (value === "organizer" || value === "ORGANIZER") return "ORGANIZER";
  if (value === "admin" || value === "ADMIN") return "ADMIN";
  return "PARTICIPANT";
}

const INTENT_PARAMS: Record<UserRole, string> = {
  PARTICIPANT: "participant",
  ORGANIZER: "organizer",
  ADMIN: "admin",
};

export function intentParam(role: UserRole) {
  return INTENT_PARAMS[role];
}

const REGISTER_PATHS: Record<SelfServeRole, string> = {
  PARTICIPANT: "/register",
  ORGANIZER: "/organizer/register",
};

export function registerPathFor(role: SelfServeRole) {
  return REGISTER_PATHS[role];
}

export function pathWithNext(path: string, role: UserRole, next: string) {
  return next === homePathFor(role) ? path : `${path}?next=${encodeURIComponent(next)}`;
}

export function forgotPasswordPath(role: UserRole) {
  return `/forgot-password?intent=${intentParam(role)}`;
}

export function checkEmailPath(role: UserRole, next: string, email: string) {
  const params = new URLSearchParams({ email, intent: intentParam(role) });
  if (next !== homePathFor(role)) params.set("next", next);
  return `/check-email?${params.toString()}`;
}

export function continuePath(role: UserRole, next: string) {
  return `/auth/continue?intent=${intentParam(role)}&next=${encodeURIComponent(next)}`;
}

export function detectRoleConflict(accountRole: UserRole, intent: UserRole): RoleConflict | null {
  if (accountRole === intent) return null;
  if (intent === "ADMIN") return "role-not-admin";
  if (accountRole === "ADMIN") return "role-admin";
  return accountRole === "PARTICIPANT" ? "role-participant" : "role-organizer";
}

export function parseRoleConflict(value: unknown): RoleConflict | null {
  return value === "role-participant" ||
    value === "role-organizer" ||
    value === "role-admin" ||
    value === "role-not-admin"
    ? value
    : null;
}

export function pageConflict(sessionRole: UserRole | null, intent: UserRole, error: unknown): RoleConflict | null {
  const fromSession = sessionRole ? detectRoleConflict(sessionRole, intent) : null;
  return fromSession ?? parseRoleConflict(error);
}

export function resolveNewUserRole(intent: unknown): SelfServeRole | null {
  const role = parseIntent(intent);
  return role === "ADMIN" ? null : role;
}

export function resolvePostLoginPath(role: UserRole, next: unknown, hasProfile: boolean) {
  const fallback = homePathFor(role);
  if (role === "ADMIN") return isSafeRedirectPath(next) && isAdminDestination(next) ? next : fallback;
  if (role === "ORGANIZER") {
    const path = isSafeRedirectPath(next) && isOrganizerPath(next) ? next : fallback;
    return hasProfile ? path : `/organizer/register?next=${encodeURIComponent(path)}`;
  }
  const path = isSafeRedirectPath(next) ? next : fallback;
  return isOrganizerPath(path) || isAdminPath(path) ? fallback : path;
}

function isAdminPath(path: string) {
  return path === "/admin" || path.startsWith("/admin/") || path.startsWith("/admin?");
}

function isAdminDestination(path: string) {
  return isAdminPath(path) && path !== "/admin/login" && !path.startsWith("/admin/login?");
}

function isOrganizerPath(path: string) {
  return path === "/organizer" || path.startsWith("/organizer/") || path.startsWith("/organizer?");
}
