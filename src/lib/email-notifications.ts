import { ACCOUNT_NOTICE_BUCKET_SECONDS, AUTH_EMAIL_BUCKET_SECONDS, timeBucket } from "@/lib/auth-config";
import { EMAIL_PRIORITY, type OutboxItem } from "@/lib/email-outbox";
import { formatEventDateTime, formatEventSchedule } from "@/lib/timezone";

type EventInfo = { title: string; startAt: Date; timezone: string };

type Recipient = { id: string; name: string; email: string };

export function ticketConfirmedEmail(registration: Recipient, event: EventInfo & { venue: string }): OutboxItem {
  return {
    to: registration.email,
    dedupeKey: `ticket-confirmed:${registration.id}`,
    priority: EMAIL_PRIORITY.TRANSACTIONAL,
    template: "ticket-confirmed",
    payload: {
      name: registration.name,
      eventTitle: event.title,
      schedule: formatEventSchedule(event.startAt, event.timezone),
      venue: event.venue,
      ticketPath: `/me/tickets/${registration.id}`,
    },
  };
}

export function eventCancelledEmail(registration: Recipient, event: EventInfo & { id: string; reason: string }): OutboxItem {
  return {
    to: registration.email,
    dedupeKey: `event-cancelled:${event.id}:${registration.id}`,
    priority: EMAIL_PRIORITY.TRANSACTIONAL,
    template: "event-cancelled",
    payload: {
      name: registration.name,
      eventTitle: event.title,
      schedule: formatEventSchedule(event.startAt, event.timezone),
      reason: event.reason,
      ticketPath: `/me/tickets/${registration.id}`,
    },
  };
}

export function signerInviteEmail(
  signer: { name: string; email: string; token: string; tokenHash: string; tokenExpiresAt: Date },
  event: { title: string; timezone: string; organizerName: string },
): OutboxItem {
  return {
    to: signer.email,
    dedupeKey: `signer-invite:${signer.tokenHash}`,
    priority: EMAIL_PRIORITY.TRANSACTIONAL,
    template: "signer-invite",
    payload: {
      signerName: signer.name,
      eventTitle: event.title,
      organizerName: event.organizerName,
      expiresOn: formatEventDateTime(signer.tokenExpiresAt, event.timezone),
      signPath: `/sign/${signer.token}`,
    },
  };
}

export function certificateIssuedEmail(registration: Recipient, event: { title: string }): OutboxItem {
  return {
    to: registration.email,
    dedupeKey: `certificate-issued:${registration.id}`,
    priority: EMAIL_PRIORITY.BULK,
    template: "certificate-issued",
    payload: {
      name: registration.name,
      eventTitle: event.title,
      certificatesPath: "/me/certificates",
    },
  };
}

type AuthRecipient = { id: string; name: string; email: string };

function authPath(url: string) {
  const parsed = new URL(url);
  return `${parsed.pathname}${parsed.search}`;
}

export function verifyEmail(user: AuthRecipient, url: string, now = new Date()): OutboxItem {
  return {
    to: user.email,
    dedupeKey: `verify-email:${user.id}:${timeBucket(now, AUTH_EMAIL_BUCKET_SECONDS)}`,
    priority: EMAIL_PRIORITY.AUTH,
    template: "verify-email",
    payload: { name: user.name, verifyPath: authPath(url) },
  };
}

export function resetPasswordEmail(user: AuthRecipient, url: string, now = new Date()): OutboxItem {
  return {
    to: user.email,
    dedupeKey: `reset-password:${user.id}:${timeBucket(now, AUTH_EMAIL_BUCKET_SECONDS)}`,
    priority: EMAIL_PRIORITY.AUTH,
    template: "reset-password",
    payload: { name: user.name, resetPath: authPath(url) },
  };
}

export function accountExistsEmail(
  user: AuthRecipient,
  options: { reason: "signup" | "reset"; method: "google" | "password"; loginPath: string },
  now = new Date(),
): OutboxItem {
  return {
    to: user.email,
    dedupeKey: `account-exists:${options.reason}:${user.id}:${timeBucket(now, ACCOUNT_NOTICE_BUCKET_SECONDS)}`,
    priority: EMAIL_PRIORITY.AUTH,
    template: "account-exists",
    payload: { name: user.name, ...options },
  };
}
