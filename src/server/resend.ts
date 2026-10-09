import "server-only";

import { getEmailConfig } from "@/lib/env";

export type OutgoingEmail = { to: string; subject: string; html: string; text: string };

export type SendResult = { ok: true; id: string } | { ok: false; status: number | null; message: string };

export type EmailSender = (email: OutgoingEmail, idempotencyKey: string) => Promise<SendResult>;

const RESEND_EMAILS_URL = "https://api.resend.com/emails";
const REQUEST_TIMEOUT_MS = 15_000;

export function createResendSender(config = getEmailConfig(), fetchImpl: typeof fetch = fetch): EmailSender {
  return async (email, idempotencyKey) => {
    try {
      const response = await fetchImpl(RESEND_EMAILS_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          from: config.from,
          to: [email.to],
          reply_to: config.replyTo,
          subject: email.subject,
          html: email.html,
          text: email.text,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const body = (await response.json().catch(() => null)) as { id?: string; message?: string } | null;
      if (response.ok && body?.id) return { ok: true, id: body.id };
      return { ok: false, status: response.status, message: body?.message ?? response.statusText };
    } catch (error) {
      return { ok: false, status: null, message: error instanceof Error ? error.message : String(error) };
    }
  };
}
