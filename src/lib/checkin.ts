export type CheckInOutcome =
  | "VALID"
  | "ALREADY_CHECKED_IN"
  | "WRONG_EVENT"
  | "CANCELLED"
  | "EVENT_CANCELLED"
  | "INVALID";

export type CheckInParticipant = {
  registrationId: string;
  name: string;
  ticketTypeName: string;
  checkedInAt: string | null;
};

export type CheckInResult = {
  outcome: CheckInOutcome;
  participant: CheckInParticipant | null;
};

export const CHECK_IN_OUTCOME_LABELS: Record<CheckInOutcome, string> = {
  VALID: "Check-in berhasil",
  ALREADY_CHECKED_IN: "Sudah check-in",
  WRONG_EVENT: "Bukan tiket acara ini",
  CANCELLED: "Pendaftaran dibatalkan",
  EVENT_CANCELLED: "Acara ditutup",
  INVALID: "Tiket tidak valid",
};

export const DUPLICATE_SCAN_WINDOW_MS = 3000;

const TICKET_CODE_PATTERN = /^[a-z2-7]{26}$/;

export function normalizeTicketCode(raw: string): string | null {
  const code = raw.trim().toLowerCase();
  return TICKET_CODE_PATTERN.test(code) ? code : null;
}

export function isCheckInOpen(eventStatus: string): boolean {
  return eventStatus === "PUBLISHED";
}

export function isDuplicateScan(
  last: { code: string; at: number } | null,
  code: string,
  now: number,
  windowMs = DUPLICATE_SCAN_WINDOW_MS,
): boolean {
  return last !== null && last.code === code && now - last.at < windowMs;
}
