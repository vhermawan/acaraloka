export const ADMIN_EVENTS_PAGE_SIZE = 25;

export type RestorableEventStatus = "DRAFT" | "PUBLISHED" | "CANCELLED";

export function statusBeforeDisable(event: {
  cancelledAt: Date | null;
  publishedAt: Date | null;
}): RestorableEventStatus {
  if (event.cancelledAt) return "CANCELLED";
  if (event.publishedAt) return "PUBLISHED";
  return "DRAFT";
}
