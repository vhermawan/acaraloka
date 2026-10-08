type PublishCandidate = {
  status: string;
  startAt: Date;
  endAt: Date;
  ticketTypeCount: number;
};

export type PublishRequirement = {
  key: "tickets" | "startInFuture" | "endAfterStart";
  label: string;
  met: boolean;
};

export function getPublishChecklist(event: Omit<PublishCandidate, "status">, now = new Date()): PublishRequirement[] {
  return [
    { key: "tickets", label: "Tambahkan minimal satu jenis tiket.", met: event.ticketTypeCount >= 1 },
    { key: "startInFuture", label: "Waktu mulai harus di masa depan.", met: event.startAt > now },
    { key: "endAfterStart", label: "Waktu selesai harus setelah waktu mulai.", met: event.endAt > event.startAt },
  ];
}

export function getPublishIssues(event: PublishCandidate, now = new Date()): string[] {
  const issues = getPublishChecklist(event, now)
    .filter((item) => !item.met)
    .map((item) => item.label);
  return event.status === "DRAFT" ? issues : ["Hanya acara draf yang bisa diterbitkan.", ...issues];
}

export const PUBLIC_EVENT_STATUSES = ["PUBLISHED", "CANCELLED"] as const;

export function isPubliclyVisible(status: string): boolean {
  return (PUBLIC_EVENT_STATUSES as readonly string[]).includes(status);
}
