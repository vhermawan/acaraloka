import { redactEmails } from "@/lib/email-outbox";
import { emailPayloadSchemas, type EmailTemplateName } from "@/lib/email-templates";

export const ADMIN_EMAIL_PAGE_SIZE = 25;
export const MANUAL_DRAIN_MAX_EMAILS = 20;
export const MANUAL_DRAIN_COOLDOWN_MS = 30_000;
export const MAX_DISPLAY_ERROR_LENGTH = 200;

export const EMAIL_STATUS_FILTERS = ["PENDING", "SENDING", "SENT", "FAILED"] as const;
export type EmailStatusFilter = (typeof EMAIL_STATUS_FILTERS)[number];

export const EMAIL_STATUS_LABELS: Record<EmailStatusFilter, string> = {
  PENDING: "Antre",
  SENDING: "Dikirim",
  SENT: "Terkirim",
  FAILED: "Gagal",
};

export const EMAIL_TEMPLATES = Object.keys(emailPayloadSchemas) as EmailTemplateName[];

export const EMAIL_TEMPLATE_LABELS: Record<EmailTemplateName, string> = {
  "ticket-confirmed": "Tiket terkonfirmasi",
  "event-cancelled": "Acara dibatalkan",
  "signer-invite": "Undangan penandatangan",
  "certificate-issued": "Sertifikat terbit",
  "verify-email": "Verifikasi email",
  "reset-password": "Atur ulang kata sandi",
  "account-exists": "Akun sudah terdaftar",
};

export type AdminEmailFilters = {
  status: EmailStatusFilter | null;
  template: EmailTemplateName | null;
};

function single(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseEmailStatusFilter(value: unknown): EmailStatusFilter | null {
  const candidate = single(value);
  return EMAIL_STATUS_FILTERS.find((status) => status === candidate) ?? null;
}

export function parseEmailTemplateFilter(value: unknown): EmailTemplateName | null {
  const candidate = single(value);
  return EMAIL_TEMPLATES.find((template) => template === candidate) ?? null;
}

export function remainingBudget(budget: number, used: number): number {
  return Math.max(0, budget - used);
}

const MASKED = "***";
const MAX_DOMAIN_LENGTH = 60;

export function maskEmail(value: string | null | undefined): string {
  const raw = value ?? "";
  const bracketed = /<([^<>]*)>/.exec(raw)?.[1];
  const cleaned = (bracketed ?? raw).replace(/[\s<>"'\u0000-\u001f\u007f]+/g, "").toLowerCase();
  const at = cleaned.lastIndexOf("@");
  if (at <= 0 || at === cleaned.length - 1) return MASKED;

  const local = cleaned.slice(0, at);
  const domain = cleaned.slice(at + 1);
  const visible = Math.min(2, Math.floor(local.length / 2));
  const shownDomain = domain.length > MAX_DOMAIN_LENGTH ? `${domain.slice(0, MAX_DOMAIN_LENGTH)}…` : domain;
  return `${local.slice(0, visible)}${MASKED}@${shownDomain}`;
}

export function redactEmailError(value: string | null | undefined): string | null {
  if (!value) return null;
  let text = value
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/\b(proxy-authorization|authorization)\b["']?\s*[:=]\s*(?:(?:bearer|basic|digest|token)\s+)?["']?[^\s"',}]+/gi, "$1=[redacted]")
    .replace(/\b(bearer|basic)\s+\S+/gi, "$1 [redacted]")
    .replace(/\btoken\s+\S{8,}/gi, "token [redacted]")
    .replace(/([\w-]*(?:token|key|secret|password))["']?\s*[:=]\s*["']?[^\s"',}]+/gi, "$1=[redacted]");
  text = redactEmails(text)
    .replace(/[A-Za-z0-9_\-.~+/=]{20,}/g, "[token]")
    .replace(/[\u0000-\u001f\u007f\s]+/g, " ")
    .trim();
  if (!text) return null;
  return text.length > MAX_DISPLAY_ERROR_LENGTH ? `${text.slice(0, MAX_DISPLAY_ERROR_LENGTH)}…` : text;
}
