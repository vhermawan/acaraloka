export type TicketState = "ACTIVE" | "CHECKED_IN" | "CANCELLED" | "EVENT_CANCELLED" | "ENDED";

export function ticketState(
  registration: { status: string; checkedInAt: Date | null },
  event: { status: string; endAt: Date },
  now = new Date(),
): TicketState {
  if (event.status === "CANCELLED") return "EVENT_CANCELLED";
  if (registration.status === "CANCELLED") return "CANCELLED";
  if (registration.checkedInAt) return "CHECKED_IN";
  if (event.endAt <= now) return "ENDED";
  return "ACTIVE";
}

export const TICKET_STATE_LABELS: Record<TicketState, string> = {
  ACTIVE: "Aktif",
  CHECKED_IN: "Sudah check-in",
  CANCELLED: "Dibatalkan",
  EVENT_CANCELLED: "Acara dibatalkan",
  ENDED: "Selesai",
};
