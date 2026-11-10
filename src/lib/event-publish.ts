type PublishCandidate = {
  status: string;
  startAt: Date;
  endAt: Date;
  ticketTypeCount: number;
  paidTicketCount: number;
  paymentInstructions: string | null;
  paymentWindowHours: number | null;
};

export type PublishRequirement = {
  key: "tickets" | "startInFuture" | "endAfterStart" | "payment";
  label: string;
  met: boolean;
};

export function hasPaymentSetup(event: Pick<PublishCandidate, "paymentInstructions" | "paymentWindowHours">): boolean {
  return Boolean(event.paymentInstructions?.trim()) && event.paymentWindowHours != null && event.paymentWindowHours > 0;
}

export function getPublishChecklist(event: Omit<PublishCandidate, "status">, now = new Date()): PublishRequirement[] {
  const checklist: PublishRequirement[] = [
    { key: "tickets", label: "Tambahkan minimal satu jenis tiket.", met: event.ticketTypeCount >= 1 },
    { key: "startInFuture", label: "Waktu mulai harus di masa depan.", met: event.startAt > now },
    { key: "endAfterStart", label: "Waktu selesai harus setelah waktu mulai.", met: event.endAt > event.startAt },
  ];
  if (event.paidTicketCount > 0) {
    checklist.push({
      key: "payment",
      label: "Isi instruksi pembayaran dan batas waktu bayar di detail acara, karena ada tiket berbayar.",
      met: hasPaymentSetup(event),
    });
  }
  return checklist;
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
