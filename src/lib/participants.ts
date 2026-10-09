export const PARTICIPANTS_PAGE_SIZE = 25;

export type ParticipantStatus = "REGISTERED" | "ATTENDED" | "CANCELLED";

export const PARTICIPANT_STATUS_LABELS: Record<ParticipantStatus, string> = {
  REGISTERED: "Terdaftar",
  ATTENDED: "Hadir",
  CANCELLED: "Batal",
};

export function participantStatus(registration: { status: string; checkedInAt: Date | null }): ParticipantStatus {
  if (registration.status === "CANCELLED") return "CANCELLED";
  if (registration.checkedInAt) return "ATTENDED";
  return "REGISTERED";
}

export const MAX_PAGE = 10_000;

export function parsePage(value: unknown): number {
  const page = Number(Array.isArray(value) ? value[0] : value);
  return Number.isSafeInteger(page) && page > 0 ? Math.min(page, MAX_PAGE) : 1;
}

export function parseQuery(value: unknown): string {
  const query = Array.isArray(value) ? value[0] : value;
  return typeof query === "string" ? query.trim().slice(0, 100) : "";
}

export function answerValue(answers: unknown, fieldId: string): string {
  if (!Array.isArray(answers)) return "";
  const match = answers.find(
    (answer): answer is { fieldId: string; value: unknown } =>
      typeof answer === "object" && answer !== null && "fieldId" in answer && answer.fieldId === fieldId,
  );
  return typeof match?.value === "string" ? match.value : "";
}
