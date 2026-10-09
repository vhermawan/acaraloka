import { USER_ROLES, type UserRole } from "@/lib/roles";

export const ADMIN_USERS_PAGE_SIZE = 25;
export const USER_DETAIL_LIST_LIMIT = 20;

export const USER_STATUS_FILTERS = ["active", "disabled"] as const;
export type UserStatusFilter = (typeof USER_STATUS_FILTERS)[number];

export type AdminUserFilters = {
  query: string;
  role: UserRole | null;
  status: UserStatusFilter | null;
};

export const ROLE_LABELS: Record<UserRole, string> = {
  PARTICIPANT: "Peserta",
  ORGANIZER: "Panitia",
  ADMIN: "Admin",
};

export const STATUS_LABELS: Record<UserStatusFilter, string> = {
  active: "Aktif",
  disabled: "Dinonaktifkan",
};

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  credential: "Password",
};

function single(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseRoleFilter(value: unknown): UserRole | null {
  const candidate = single(value);
  return USER_ROLES.find((role) => role === candidate) ?? null;
}

export function parseStatusFilter(value: unknown): UserStatusFilter | null {
  const candidate = single(value);
  return USER_STATUS_FILTERS.find((status) => status === candidate) ?? null;
}

export function loginMethods(providerIds: string[]): string[] {
  const labels = providerIds.map((id) => PROVIDER_LABELS[id] ?? id);
  return [...new Set(labels)].sort();
}

export type UserDisableDenial = "SELF" | "ADMIN_TARGET";

export function userDisableDenial(
  target: { id: string; role: string },
  actorId: string,
): UserDisableDenial | null {
  if (target.id === actorId) return "SELF";
  if (target.role === "ADMIN") return "ADMIN_TARGET";
  return null;
}

export function describeUserAgent(userAgent: string | null): string {
  if (!userAgent) return "Tidak diketahui";
  const browser =
    /Edg\//.test(userAgent)
      ? "Edge"
      : /OPR\//.test(userAgent)
        ? "Opera"
        : /Chrome\//.test(userAgent)
          ? "Chrome"
          : /Firefox\//.test(userAgent)
            ? "Firefox"
            : /Safari\//.test(userAgent)
              ? "Safari"
              : "Peramban lain";
  const system = /Android/.test(userAgent)
    ? "Android"
    : /iPhone|iPad/.test(userAgent)
      ? "iOS"
      : /Windows/.test(userAgent)
        ? "Windows"
        : /Mac OS X/.test(userAgent)
          ? "macOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : null;
  return system ? `${browser} di ${system}` : browser;
}
