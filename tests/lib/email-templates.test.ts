import { describe, expect, it } from "vitest";

import { APP_NAME } from "@/lib/brand";
import {
  certificateIssuedEmail,
  eventCancelledEmail,
  signerInviteEmail,
  ticketConfirmedEmail,
} from "@/lib/email-notifications";
import type { OutboxItem } from "@/lib/email-outbox";
import { escapeHtml, parseEmailMessage, renderEmail } from "@/lib/email-templates";

const BASE_URL = "https://acaraloka.test";
const event = { id: "ev1", title: "Workshop <Next.js>", startAt: new Date("2026-11-01T02:00:00Z"), timezone: "Asia/Jakarta" };
const registration = { id: "reg1", name: "Budi & Sari", email: "budi@contoh.test" };

const messages: OutboxItem[] = [
  ticketConfirmedEmail(registration, { ...event, venue: "Aula A" }),
  eventCancelledEmail(registration, { ...event, reason: "Pembicara berhalangan" }),
  signerInviteEmail(
    { name: "Dr. Rina", email: "rina@contoh.test", token: "tok123", tokenHash: "hash123", tokenExpiresAt: new Date("2026-11-15T02:00:00Z") },
    { title: event.title, timezone: event.timezone, organizerName: "HIMA Informatika" },
  ),
  certificateIssuedEmail(registration, event),
];

describe("renderEmail", () => {
  it.each(messages.map((message) => [message.template, message] as const))("renders %s with absolute links", (_, message) => {
    const rendered = renderEmail(message, BASE_URL);

    expect(rendered.subject.length).toBeGreaterThan(0);
    expect(rendered.html).toContain(`href="${BASE_URL}/`);
    expect(rendered.text).toContain(`${BASE_URL}/`);
    expect(rendered.html).toContain(APP_NAME);
    expect(`${rendered.subject}${rendered.html}${rendered.text}`).not.toContain("—");
  });

  it("escapes user-provided values in HTML", () => {
    const rendered = renderEmail(messages[0], BASE_URL);

    expect(rendered.html).toContain("Workshop &lt;Next.js&gt;");
    expect(rendered.html).toContain("Budi &amp; Sari");
    expect(rendered.html).not.toContain("<Next.js>");
    expect(rendered.text).toContain("Workshop <Next.js>");
  });

  it("links each template to its page", () => {
    expect(renderEmail(messages[0], BASE_URL).text).toContain(`${BASE_URL}/me/tickets/reg1`);
    expect(renderEmail(messages[1], BASE_URL).text).toContain("Pembicara berhalangan");
    expect(renderEmail(messages[2], BASE_URL).text).toContain(`${BASE_URL}/sign/tok123`);
    expect(renderEmail(messages[3], BASE_URL).text).toContain(`${BASE_URL}/me/certificates`);
  });
});

describe("parseEmailMessage", () => {
  it("accepts a stored payload", () => {
    const { template, payload } = messages[0];
    expect(parseEmailMessage(template, payload)).toEqual({ template, payload });
  });

  it("rejects unknown templates and malformed payloads", () => {
    expect(parseEmailMessage("unknown", {})).toBeNull();
    expect(parseEmailMessage("ticket-confirmed", { name: "A" })).toBeNull();
    expect(parseEmailMessage("ticket-confirmed", { ...messages[0].payload, ticketPath: "https://evil.test" })).toBeNull();
    expect(parseEmailMessage("ticket-confirmed", { ...messages[0].payload, ticketPath: "//evil.test/x" })).toBeNull();
    expect(parseEmailMessage("ticket-confirmed", { ...messages[0].payload, ticketPath: "/\\evil.test/x" })).toBeNull();
  });
});

describe("notification builders", () => {
  it("uses stable dedupe keys and priorities", () => {
    expect(messages.map((message) => message.dedupeKey)).toEqual([
      "ticket-confirmed:reg1",
      "event-cancelled:ev1:reg1",
      "signer-invite:hash123",
      "certificate-issued:reg1",
    ]);
    expect(messages.map((message) => message.priority)).toEqual([1, 1, 1, 2]);
  });
});

describe("escapeHtml", () => {
  it("escapes quotes and angle brackets", () => {
    expect(escapeHtml(`<a href="x">'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&lt;/a&gt;");
  });
});
