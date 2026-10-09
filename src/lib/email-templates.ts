import { z } from "zod";

import { RESET_TTL_SECONDS, VERIFICATION_TTL_SECONDS } from "@/lib/auth-config";
import { APP_NAME } from "@/lib/brand";

const path = z.string().regex(/^\/(?![/\\])/);

export const emailPayloadSchemas = {
  "ticket-confirmed": z.object({
    name: z.string(),
    eventTitle: z.string(),
    schedule: z.string(),
    venue: z.string(),
    ticketPath: path,
  }),
  "event-cancelled": z.object({
    name: z.string(),
    eventTitle: z.string(),
    schedule: z.string(),
    reason: z.string(),
    ticketPath: path,
  }),
  "signer-invite": z.object({
    signerName: z.string(),
    eventTitle: z.string(),
    organizerName: z.string(),
    expiresOn: z.string(),
    signPath: path,
  }),
  "certificate-issued": z.object({
    name: z.string(),
    eventTitle: z.string(),
    certificatesPath: path,
  }),
  "verify-email": z.object({
    name: z.string(),
    verifyPath: path,
  }),
  "reset-password": z.object({
    name: z.string(),
    resetPath: path,
  }),
  "account-exists": z.object({
    name: z.string(),
    reason: z.enum(["signup", "reset"]),
    method: z.enum(["google", "password"]),
    loginPath: path,
  }),
};

export type EmailTemplateName = keyof typeof emailPayloadSchemas;

export type EmailPayloads = { [K in EmailTemplateName]: z.infer<(typeof emailPayloadSchemas)[K]> };

export type EmailMessage = { [K in EmailTemplateName]: { template: K; payload: EmailPayloads[K] } }[EmailTemplateName];

export type RenderedEmail = { subject: string; html: string; text: string };

export function parseEmailMessage(template: string, payload: unknown): EmailMessage | null {
  if (!(template in emailPayloadSchemas)) return null;
  const name = template as EmailTemplateName;
  const parsed = emailPayloadSchemas[name].safeParse(payload);
  return parsed.success ? ({ template: name, payload: parsed.data } as EmailMessage) : null;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type Detail = { label: string; value: string };

type EmailContent = {
  subject: string;
  heading: string;
  paragraphs: string[];
  details?: Detail[];
  action: { label: string; url: string };
  note?: string;
};

const COLORS = { brand: "#0F5257", ink: "#10202A", muted: "#4A5A62", line: "#E2E8E8", page: "#F4F6F6" };
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function formatDuration(seconds: number): string {
  return seconds % 3600 === 0 ? `${seconds / 3600} jam` : `${Math.round(seconds / 60)} menit`;
}

function renderHtml(content: EmailContent, host: string): string {
  const paragraphs = content.paragraphs
    .map((text) => `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${COLORS.ink}">${escapeHtml(text)}</p>`)
    .join("");
  const details = content.details?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px;border-top:1px solid ${COLORS.line}">${content.details
        .map(
          (detail) =>
            `<tr><td style="padding:10px 12px 10px 0;font-size:13px;color:${COLORS.muted};white-space:nowrap;vertical-align:top;border-bottom:1px solid ${COLORS.line}">${escapeHtml(detail.label)}</td><td style="padding:10px 0;font-size:14px;color:${COLORS.ink};border-bottom:1px solid ${COLORS.line}">${escapeHtml(detail.value)}</td></tr>`,
        )
        .join("")}</table>`
    : "";
  const note = content.note
    ? `<p style="margin:20px 0 0;font-size:13px;line-height:20px;color:${COLORS.muted}">${escapeHtml(content.note)}</p>`
    : "";
  const url = escapeHtml(content.action.url);

  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(content.subject)}</title></head><body style="margin:0;padding:0;background:${COLORS.page};font-family:${FONT}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.page}"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid ${COLORS.line};border-radius:8px"><tr><td style="padding:24px 28px 0;font-size:17px;font-weight:700;color:${COLORS.brand}">${APP_NAME}</td></tr><tr><td style="padding:20px 28px 28px"><h1 style="margin:0 0 16px;font-size:21px;line-height:28px;color:${COLORS.ink}">${escapeHtml(content.heading)}</h1>${paragraphs}${details}<a href="${url}" style="display:inline-block;background:${COLORS.brand};color:#FFFFFF;font-size:15px;font-weight:600;text-decoration:none;padding:12px 20px;border-radius:6px">${escapeHtml(content.action.label)}</a><p style="margin:20px 0 0;font-size:13px;line-height:20px;color:${COLORS.muted}">Kalau tombol tidak bisa dibuka, salin tautan ini ke browser:<br><a href="${url}" style="color:${COLORS.brand};word-break:break-all">${url}</a></p>${note}</td></tr></table><p style="margin:16px 0 0;font-size:12px;line-height:18px;color:${COLORS.muted}">Email otomatis dari ${APP_NAME} (${escapeHtml(host)}).</p></td></tr></table></body></html>`;
}

function renderText(content: EmailContent, host: string): string {
  return [
    content.heading,
    "",
    ...content.paragraphs.flatMap((text) => [text, ""]),
    ...(content.details?.length ? [...content.details.map((detail) => `${detail.label}: ${detail.value}`), ""] : []),
    `${content.action.label}: ${content.action.url}`,
    ...(content.note ? ["", content.note] : []),
    "",
    `Email otomatis dari ${APP_NAME} (${host}).`,
  ].join("\n");
}

function buildContent(message: EmailMessage, link: (path: string) => string): EmailContent {
  switch (message.template) {
    case "ticket-confirmed": {
      const { name, eventTitle, schedule, venue, ticketPath } = message.payload;
      return {
        subject: `E-tiket kamu untuk ${eventTitle}`,
        heading: "Pendaftaran terkonfirmasi",
        paragraphs: [
          `Halo ${name}, kamu terdaftar di ${eventTitle}.`,
          "Tunjukkan QR e-tiket ke panitia saat check-in.",
        ],
        details: [
          { label: "Waktu", value: schedule },
          { label: "Lokasi", value: venue },
        ],
        action: { label: "Buka e-tiket", url: link(ticketPath) },
        note: "E-tiket juga selalu ada di menu Tiket Saya setelah kamu masuk.",
      };
    }
    case "event-cancelled": {
      const { name, eventTitle, schedule, reason, ticketPath } = message.payload;
      return {
        subject: `${eventTitle} dibatalkan`,
        heading: "Acara dibatalkan",
        paragraphs: [`Halo ${name}, panitia membatalkan ${eventTitle}. Tiketmu tidak berlaku lagi.`],
        details: [
          { label: "Jadwal semula", value: schedule },
          { label: "Alasan", value: reason },
        ],
        action: { label: "Lihat detail tiket", url: link(ticketPath) },
        note: "Untuk pertanyaan soal pembatalan, hubungi panitia acara.",
      };
    }
    case "signer-invite": {
      const { signerName, eventTitle, organizerName, expiresOn, signPath } = message.payload;
      return {
        subject: `Permintaan tanda tangan sertifikat ${eventTitle}`,
        heading: "Permintaan tanda tangan sertifikat",
        paragraphs: [
          `Yth. ${signerName}, ${organizerName} meminta Anda menandatangani sertifikat ${eventTitle}.`,
          "Buka tautan di bawah untuk melihat pratinjau sertifikat, lalu setujui dan gambar tanda tangan Anda. Anda juga bisa menolak bila ada yang keliru.",
        ],
        action: { label: "Tinjau sertifikat", url: link(signPath) },
        note: `Tautan berlaku sampai ${expiresOn} dan khusus untuk Anda. Jangan teruskan email ini.`,
      };
    }
    case "certificate-issued": {
      const { name, eventTitle, certificatesPath } = message.payload;
      return {
        subject: `Sertifikat ${eventTitle} sudah terbit`,
        heading: "Sertifikat kamu sudah terbit",
        paragraphs: [`Halo ${name}, sertifikat kehadiranmu di ${eventTitle} sudah bisa diunduh.`],
        action: { label: "Unduh sertifikat", url: link(certificatesPath) },
        note: "Sertifikat bisa diunduh kapan saja dari menu Sertifikat Saya.",
      };
    }
    case "verify-email": {
      const { name, verifyPath } = message.payload;
      return {
        subject: `Verifikasi email akun ${APP_NAME}`,
        heading: "Verifikasi email kamu",
        paragraphs: [
          `Halo ${name}, terima kasih sudah mendaftar di ${APP_NAME}.`,
          "Klik tombol di bawah untuk memverifikasi email dan mengaktifkan akunmu.",
        ],
        action: { label: "Verifikasi email", url: link(verifyPath) },
        note: `Tautan berlaku ${formatDuration(VERIFICATION_TTL_SECONDS)}. Kalau kamu tidak merasa mendaftar, abaikan email ini.`,
      };
    }
    case "reset-password": {
      const { name, resetPath } = message.payload;
      return {
        subject: `Atur ulang password ${APP_NAME}`,
        heading: "Atur ulang password",
        paragraphs: [
          `Halo ${name}, kami menerima permintaan untuk mengatur ulang password akun ${APP_NAME}-mu.`,
          "Klik tombol di bawah untuk memilih password baru.",
        ],
        action: { label: "Atur password baru", url: link(resetPath) },
        note: `Tautan berlaku ${formatDuration(RESET_TTL_SECONDS)} dan hanya bisa dipakai sekali. Kalau bukan kamu yang meminta, abaikan email ini; passwordmu tidak berubah.`,
      };
    }
    case "account-exists": {
      const { name, reason, method, loginPath } = message.payload;
      const intro =
        reason === "signup"
          ? `Halo ${name}, seseorang mencoba mendaftar di ${APP_NAME} dengan email ini, padahal akunmu sudah ada.`
          : `Halo ${name}, kami menerima permintaan atur ulang password untuk email ini, tetapi akunmu masuk lewat Google dan tidak memakai password.`;
      const guide =
        method === "google"
          ? 'Masuk dengan tombol "Masuk dengan Google" di halaman masuk.'
          : 'Masuk dengan email dan passwordmu, atau lewat Google. Kalau lupa password, pakai tautan "Lupa password" di halaman masuk.';
      return {
        subject: `Kamu sudah punya akun ${APP_NAME}`,
        heading: "Akunmu sudah terdaftar",
        paragraphs: [intro, guide],
        action: { label: "Buka halaman masuk", url: link(loginPath) },
        note: "Kalau bukan kamu yang melakukannya, abaikan email ini. Akunmu aman.",
      };
    }
  }
}

export function renderEmail(message: EmailMessage, baseUrl: string): RenderedEmail {
  const link = (path: string) => new URL(path, baseUrl).toString();
  const host = new URL(baseUrl).host;
  const content = buildContent(message, link);
  return { subject: content.subject, html: renderHtml(content, host), text: renderText(content, host) };
}
