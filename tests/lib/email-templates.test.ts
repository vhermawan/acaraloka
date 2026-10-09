import { describe, expect, it } from "vitest";

import { APP_NAME } from "@/lib/brand";
import {
  accountExistsEmail,
  certificateIssuedEmail,
  eventCancelledEmail,
  resetPasswordEmail,
  signerInviteEmail,
  ticketConfirmedEmail,
  verifyEmail,
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

describe("auth emails", () => {
  const user = { id: "u1", name: "Sari <Admin>", email: "sari@contoh.test" };
  const at = new Date("2026-10-09T10:00:30Z");
  const verifyUrl = "http://localhost:3000/api/auth/verify-email?token=abc.def.ghi&callbackURL=%2Fauth%2Fcontinue";
  const resetUrl = "http://localhost:3000/api/auth/reset-password/tok123?callbackURL=%2Freset-password";

  it("renders Indonesian copy with absolute links and escaped names", () => {
    const verify = renderEmail(verifyEmail(user, verifyUrl, at), BASE_URL);
    expect(verify.subject).toBe("Verifikasi email akun Acaraloka");
    expect(verify.text).toContain(`${BASE_URL}/api/auth/verify-email?token=abc.def.ghi&callbackURL=%2Fauth%2Fcontinue`);
    expect(verify.text).toContain("24 jam");
    expect(verify.html).toContain("Sari &lt;Admin&gt;");
    expect(verify.html).not.toContain("<Admin>");

    const reset = renderEmail(resetPasswordEmail(user, resetUrl, at), BASE_URL);
    expect(reset.text).toContain(`${BASE_URL}/api/auth/reset-password/tok123?callbackURL=%2Freset-password`);
    expect(reset.text).toContain("1 jam");
  });

  it("explains how to sign in when the account already exists", () => {
    const google = renderEmail(accountExistsEmail(user, { reason: "reset", method: "google", loginPath: "/login" }, at), BASE_URL);
    expect(google.text).toContain("masuk lewat Google dan tidak memakai password");
    expect(google.text).toContain(`${BASE_URL}/login`);
    const password = renderEmail(
      accountExistsEmail(user, { reason: "signup", method: "password", loginPath: "/organizer/login" }, at),
      BASE_URL,
    );
    expect(password.text).toContain("Lupa password");
    expect(password.text).toContain(`${BASE_URL}/organizer/login`);
  });

  it("uses top priority and per-window dedupe keys so resending still works", () => {
    const first = verifyEmail(user, verifyUrl, at);
    const sameMinute = verifyEmail(user, verifyUrl, new Date(at.getTime() + 20_000));
    const nextMinute = verifyEmail(user, verifyUrl, new Date(at.getTime() + 60_000));
    expect(first.priority).toBe(0);
    expect(sameMinute.dedupeKey).toBe(first.dedupeKey);
    expect(nextMinute.dedupeKey).not.toBe(first.dedupeKey);
    expect(resetPasswordEmail(user, resetUrl, at).priority).toBe(0);
    expect(accountExistsEmail(user, { reason: "signup", method: "google", loginPath: "/login" }, at).priority).toBe(0);
  });

  it("keeps the token out of anything but the payload path", () => {
    const item = verifyEmail(user, verifyUrl, at);
    expect(item.dedupeKey).not.toContain("abc.def.ghi");
    expect(item.payload).toEqual({ name: user.name, verifyPath: "/api/auth/verify-email?token=abc.def.ghi&callbackURL=%2Fauth%2Fcontinue" });
    expect(parseEmailMessage(item.template, item.payload)).not.toBeNull();
  });
});
