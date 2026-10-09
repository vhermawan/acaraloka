export const ADMIN_ORGANIZERS_PAGE_SIZE = 25;
export const ORGANIZER_EVENT_LIST_LIMIT = 20;

export const ORGANIZER_SORTS = ["newest", "name", "events", "registrants", "active"] as const;
export type OrganizerSort = (typeof ORGANIZER_SORTS)[number];
export const DEFAULT_ORGANIZER_SORT: OrganizerSort = "newest";

export const ORGANIZER_SORT_LABELS: Record<OrganizerSort, string> = {
  newest: "Terbaru bergabung",
  name: "Nama organisasi (A-Z)",
  events: "Acara terbanyak",
  registrants: "Pendaftar terbanyak",
  active: "Terakhir aktif",
};

export type AdminOrganizerFilters = {
  query: string;
  sort: OrganizerSort;
};

export function parseOrganizerSort(value: unknown): OrganizerSort {
  const candidate = Array.isArray(value) ? value[0] : value;
  return ORGANIZER_SORTS.find((sort) => sort === candidate) ?? DEFAULT_ORGANIZER_SORT;
}

const MAX_ID_LENGTH = 64;

export function parseOrganizerFilter(value: unknown): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate !== "string") return null;
  const id = candidate.trim();
  return id.length > 0 && id.length <= MAX_ID_LENGTH ? id : null;
}

export type OrganizerEventCounts = {
  draft: number;
  published: number;
  cancelled: number;
  disabled: number;
};

export type OrganizerAggregateRow = {
  user_id: string;
  org_name: string;
  contact_phone: string;
  contact_email: string | null;
  activated_at: Date;
  account_name: string;
  account_email: string;
  disabled_at: Date | null;
  draft_count: bigint | number;
  published_count: bigint | number;
  cancelled_count: bigint | number;
  disabled_count: bigint | number;
  registrant_count: bigint | number;
  certificate_count: bigint | number;
  last_active_at: Date | null;
};

export function mapOrganizerRow(row: OrganizerAggregateRow) {
  const eventCounts: OrganizerEventCounts = {
    draft: Number(row.draft_count),
    published: Number(row.published_count),
    cancelled: Number(row.cancelled_count),
    disabled: Number(row.disabled_count),
  };
  return {
    id: row.user_id,
    orgName: row.org_name,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    activatedAt: row.activated_at,
    accountName: row.account_name,
    accountEmail: row.account_email,
    disabledAt: row.disabled_at,
    eventCounts,
    eventTotal: eventCounts.draft + eventCounts.published + eventCounts.cancelled + eventCounts.disabled,
    registrantCount: Number(row.registrant_count),
    certificateCount: Number(row.certificate_count),
    lastActiveAt: row.last_active_at,
  };
}

export type AdminOrganizerRow = ReturnType<typeof mapOrganizerRow>;

export const EVENT_COUNT_LABELS: Record<keyof OrganizerEventCounts, string> = {
  published: "Terbit",
  draft: "Draf",
  cancelled: "Dibatalkan",
  disabled: "Dinonaktifkan",
};

export function eventCountSummary(counts: OrganizerEventCounts): string[] {
  return (Object.keys(EVENT_COUNT_LABELS) as (keyof OrganizerEventCounts)[])
    .filter((key) => counts[key] > 0)
    .map((key) => `${EVENT_COUNT_LABELS[key]} ${counts[key]}`);
}
