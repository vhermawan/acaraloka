export type IssueBlocker = "CLOSED" | "NOT_STARTED" | "NO_SIGNERS" | "NOT_SIGNED" | "NOT_LOCKED";

export const ISSUE_BLOCKER_MESSAGES: Record<IssueBlocker, string> = {
  CLOSED: "Acara ini sudah dibatalkan atau dinonaktifkan.",
  NOT_STARTED: "Sertifikat baru bisa diterbitkan setelah acara dimulai.",
  NO_SIGNERS: "Tambahkan minimal satu penandatangan.",
  NOT_SIGNED: "Semua penandatangan harus sudah tanda tangan.",
  NOT_LOCKED: "Desain belum terkunci. Terkunci otomatis setelah tanda tangan pertama.",
};

export function issueBlocker(
  input: {
    eventStatus: string;
    startAt: Date;
    lockedAt: Date | null;
    signerStatuses: readonly string[];
  },
  now: Date,
): IssueBlocker | null {
  if (input.eventStatus === "CANCELLED" || input.eventStatus === "DISABLED") return "CLOSED";
  if (input.startAt.getTime() > now.getTime()) return "NOT_STARTED";
  if (input.signerStatuses.length === 0) return "NO_SIGNERS";
  if (input.signerStatuses.some((status) => status !== "SIGNED")) return "NOT_SIGNED";
  if (!input.lockedAt) return "NOT_LOCKED";
  return null;
}
