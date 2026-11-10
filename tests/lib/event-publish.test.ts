import { describe, expect, it } from "vitest";

import { getPublishChecklist, getPublishIssues, isPubliclyVisible } from "@/lib/event-publish";

const now = new Date("2026-10-01T00:00:00Z");
const ready = {
  status: "DRAFT",
  startAt: new Date("2026-11-01T02:00:00Z"),
  endAt: new Date("2026-11-01T05:00:00Z"),
  ticketTypeCount: 1,
  paidTicketCount: 0,
  paymentInstructions: null,
  paymentWindowHours: null,
};

describe("getPublishIssues", () => {
  it("passes a complete draft", () => {
    expect(getPublishIssues(ready, now)).toEqual([]);
  });

  it("requires at least one ticket type", () => {
    expect(getPublishIssues({ ...ready, ticketTypeCount: 0 }, now)).toHaveLength(1);
  });

  it("rejects past start and inverted times", () => {
    expect(getPublishIssues({ ...ready, startAt: new Date("2026-09-30T00:00:00Z") }, now)).toContain(
      "Waktu mulai harus di masa depan.",
    );
    expect(getPublishIssues({ ...ready, endAt: ready.startAt }, now)).toContain(
      "Waktu selesai harus setelah waktu mulai.",
    );
  });

  it("rejects non-draft events", () => {
    expect(getPublishIssues({ ...ready, status: "PUBLISHED" }, now)).toContain("Hanya acara draf yang bisa diterbitkan.");
  });
});

describe("paid tickets", () => {
  const paid = { ...ready, paidTicketCount: 1 };
  const message = "Isi instruksi pembayaran dan batas waktu bayar di detail acara, karena ada tiket berbayar.";

  it("rejects paid tickets without instructions or window", () => {
    expect(getPublishIssues(paid, now)).toEqual([message]);
    expect(getPublishIssues({ ...paid, paymentInstructions: "BCA 123" }, now)).toEqual([message]);
    expect(getPublishIssues({ ...paid, paymentWindowHours: 24 }, now)).toEqual([message]);
    expect(getPublishIssues({ ...paid, paymentInstructions: "   ", paymentWindowHours: 24 }, now)).toEqual([message]);
  });

  it("passes with instructions and window", () => {
    expect(getPublishIssues({ ...paid, paymentInstructions: "BCA 123", paymentWindowHours: 24 }, now)).toEqual([]);
  });

  it("ignores payment setup for free events", () => {
    expect(getPublishChecklist(ready, now).some((item) => item.key === "payment")).toBe(false);
  });
});

describe("getPublishChecklist", () => {
  it("lists every requirement with its status", () => {
    expect(getPublishChecklist({ ...ready, ticketTypeCount: 0 }, now)).toEqual([
      { key: "tickets", label: "Tambahkan minimal satu jenis tiket.", met: false },
      { key: "startInFuture", label: "Waktu mulai harus di masa depan.", met: true },
      { key: "endAfterStart", label: "Waktu selesai harus setelah waktu mulai.", met: true },
    ]);
  });

  it("marks a start time equal to now as unmet", () => {
    const item = getPublishChecklist({ ...ready, startAt: now }, now).find((entry) => entry.key === "startInFuture");
    expect(item?.met).toBe(false);
  });
});

describe("isPubliclyVisible", () => {
  it.each([
    ["PUBLISHED", true],
    ["CANCELLED", true],
    ["DRAFT", false],
    ["DISABLED", false],
  ])("%s -> %s", (status, expected) => {
    expect(isPubliclyVisible(status)).toBe(expected);
  });
});
