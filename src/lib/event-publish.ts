type PublishCandidate = {
  status: string;
  startAt: Date;
  endAt: Date;
  ticketTypeCount: number;
};

export function getPublishIssues(event: PublishCandidate, now = new Date()): string[] {
  const issues: string[] = [];
  if (event.status !== "DRAFT") issues.push("Hanya acara draf yang bisa diterbitkan.");
  if (event.ticketTypeCount < 1) issues.push("Tambahkan minimal satu jenis tiket.");
  if (event.startAt <= now) issues.push("Waktu mulai harus di masa depan.");
  if (event.endAt <= event.startAt) issues.push("Waktu selesai harus setelah waktu mulai.");
  return issues;
}

export const PUBLIC_EVENT_STATUSES = ["PUBLISHED", "CANCELLED"] as const;

export function isPubliclyVisible(status: string): boolean {
  return (PUBLIC_EVENT_STATUSES as readonly string[]).includes(status);
}
