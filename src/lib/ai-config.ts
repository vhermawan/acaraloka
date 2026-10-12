export const AI_KINDS = ["CERTIFICATE", "POSTER"] as const;
export type AiKindValue = (typeof AI_KINDS)[number];

export const AI_PRICING = {
  imageMicros: 50_000,
  briefMicros: 5_000,
  maxImageAttempts: 2,
} as const;

export type AiPricing = {
  imageMicros: number;
  briefMicros: number;
  maxImageAttempts: number;
};

export const AI_QUOTA = {
  perEventKind: 3,
  perAccountDay: 15,
} as const;

export const AI_STALE_AFTER_MS = 150_000;

export const AI_RESERVE_LOCK_KEY = 4_204_901_001;

export const AI_UNAVAILABLE_CODE = "AI_UNAVAILABLE";
export const AI_UNAVAILABLE_MESSAGE = "Fitur AI sedang tidak tersedia.";

export const AI_DENIAL_MESSAGES = {
  UNAVAILABLE: AI_UNAVAILABLE_MESSAGE,
  EVENT_CLOSED: AI_UNAVAILABLE_MESSAGE,
  EVENT_RUNNING: "Desain sebelumnya masih dibuat. Tunggu hingga selesai.",
  EVENT_LIMIT: `Kuota AI untuk acara ini sudah habis (${AI_QUOTA.perEventKind} dari ${AI_QUOTA.perEventKind}). Kamu tetap bisa memakai hasil sebelumnya atau mengatur desain di editor.`,
  DAILY_LIMIT: `Batas ${AI_QUOTA.perAccountDay} desain AI per hari sudah tercapai. Coba lagi besok mulai pukul 00.00 WIB.`,
  CAP: "Fitur AI sedang dijeda sementara karena kapasitas bulan ini sudah penuh. Kamu tetap bisa memakai template bawaan atau upload latar sendiri.",
  GLOBAL_DAILY: "Kapasitas AI hari ini sudah penuh. Kuota tidak berkurang. Coba lagi besok.",
  LOCKED: "Desain sudah terkunci karena ada tanda tangan. Buka kunci di langkah 01 untuk membuat desain baru.",
} as const;

export type AiDenialReason = keyof typeof AI_DENIAL_MESSAGES;

export const AI_REPORT_MESSAGES = {
  NOT_AVAILABLE: "Hasil ini tidak bisa dilaporkan.",
  REPORT_USED: "Jatah lapor untuk acara ini sudah dipakai.",
} as const;

export type AiReportDenial = keyof typeof AI_REPORT_MESSAGES;

export type AiLimits = {
  monthlyCapUsd: number;
  trialCapUsd: number;
  trialEndsOn: string | null;
  globalDailyLimit: number;
};

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

function wibParts(now: Date) {
  const shifted = new Date(now.getTime() + WIB_OFFSET_MS);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth(), day: shifted.getUTCDate() };
}

export function wibDayStart(now: Date): Date {
  const { year, month, day } = wibParts(now);
  return new Date(Date.UTC(year, month, day) - WIB_OFFSET_MS);
}

export function wibMonthStart(now: Date): Date {
  const { year, month } = wibParts(now);
  return new Date(Date.UTC(year, month, 1) - WIB_OFFSET_MS);
}

export function wibDateString(now: Date): string {
  return new Date(now.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

export function activeCapUsd(now: Date, limits: Pick<AiLimits, "monthlyCapUsd" | "trialCapUsd" | "trialEndsOn">): number {
  if (limits.trialEndsOn && wibDateString(now) < limits.trialEndsOn) return limits.trialCapUsd;
  return limits.monthlyCapUsd;
}

export function usdToMicros(usd: number): number {
  return Math.round(usd * 1_000_000);
}

export function estimateGenerationMicros(pricing: AiPricing = AI_PRICING): number {
  return pricing.imageMicros * pricing.maxImageAttempts + pricing.briefMicros;
}
