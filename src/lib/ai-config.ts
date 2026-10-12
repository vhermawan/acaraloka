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
  IDEMPOTENCY_MISMATCH: "Permintaan tidak valid. Muat ulang halaman lalu coba lagi.",
  LOCKED: "Desain sudah terkunci karena ada tanda tangan. Buka kunci di langkah 01 untuk membuat desain baru.",
} as const;

export type AiDenialReason = keyof typeof AI_DENIAL_MESSAGES;

export const AI_REPORT_MESSAGES = {
  NOT_AVAILABLE: "Hasil ini tidak bisa dilaporkan.",
  REPORT_USED: "Jatah lapor untuk acara ini sudah dipakai.",
} as const;

export type AiReportDenial = keyof typeof AI_REPORT_MESSAGES;

export const AI_APPLY_MESSAGES = {
  NOT_AVAILABLE: "Hasil ini tidak tersedia lagi. Pilih hasil lain dari riwayat.",
  INVALID: "Logo atau hasil yang dipilih tidak valid. Muat ulang halaman lalu coba lagi.",
  LOCKED: AI_DENIAL_MESSAGES.LOCKED,
  NEEDS_CONFIRM: "Desain ini akan menggantikan latar dan tata letak saat ini. Konfirmasi dulu untuk melanjutkan.",
  FAILED: "Desain belum berhasil dipakai. Coba lagi sebentar lagi.",
} as const;

export type AiApplyDenial = keyof typeof AI_APPLY_MESSAGES;

export const AI_LOGO_LIMIT = 5;
export const AI_LOGO_LIMIT_MESSAGE = `Maksimal ${AI_LOGO_LIMIT} logo per acara. Hapus logo yang tidak dipakai dulu.`;
export const AI_ORPHAN_UPLOAD_MS = 60 * 60 * 1000;

export const AI_REJECTION_THROTTLE = { windowMs: 10 * 60 * 1000, max: 5 } as const;
export const AI_REJECTION_THROTTLE_MESSAGE = "Terlalu banyak percobaan yang ditolak. Tunggu beberapa menit lalu coba lagi.";

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

export const AI_TOKEN_RATES_MICROS_PER_MILLION = {
  textInput: 250_000,
  textOutput: 1_500_000,
  imageInput: 500_000,
  imageOutput: 30_000_000,
} as const;

export type AiTokenUsage = {
  promptTokens: number;
  outputTokens: number;
  thoughtTokens: number;
  imageOutputTokens: number;
};

function tokensToMicros(tokens: number, ratePerMillion: number): number {
  return Math.round((tokens * ratePerMillion) / 1_000_000);
}

export function textCostMicros(usage: AiTokenUsage, rates = AI_TOKEN_RATES_MICROS_PER_MILLION): number {
  return (
    tokensToMicros(usage.promptTokens, rates.textInput) +
    tokensToMicros(usage.outputTokens + usage.thoughtTokens, rates.textOutput)
  );
}

export function imageCostMicros(
  usage: AiTokenUsage,
  rates = AI_TOKEN_RATES_MICROS_PER_MILLION,
  fallbackMicros: number = AI_PRICING.imageMicros,
): number {
  if (usage.imageOutputTokens <= 0) return fallbackMicros;
  return tokensToMicros(usage.promptTokens, rates.imageInput) + tokensToMicros(usage.imageOutputTokens, rates.imageOutput);
}

export const AI_FAILURE_MESSAGES = {
  TECHNICAL: "Desain belum berhasil dibuat. Kuota tidak berkurang. Coba lagi sebentar lagi.",
  BUSY: "Layanan AI sedang sibuk. Kuota tidak berkurang. Coba lagi beberapa menit lagi.",
  NOTE_REJECTED: "Keterangan tambahan tidak bisa diproses. Ubah keterangan lalu coba lagi. Kuota tidak berkurang.",
} as const;

export type AiFailureKind = keyof typeof AI_FAILURE_MESSAGES;

export function failureKindFor(status: string, failureCode: string | null): AiFailureKind {
  if (status === "REJECTED") return "NOTE_REJECTED";
  if (failureCode === "VENDOR_CAPACITY") return "BUSY";
  return "TECHNICAL";
}

export const AI_PHASES = ["BRIEF", "IMAGE", "FINALIZE"] as const;
export type AiPhase = (typeof AI_PHASES)[number];

export const AI_PHASE_LABELS: Record<AiPhase, string> = {
  BRIEF: "Menyusun tata letak",
  IMAGE: "Membuat latar",
  FINALIZE: "Menyiapkan pratinjau",
};

export const AI_STATUS_POLL_MS = 2_500;

export const AI_POLL_MAX_FAILURES = 3;
export const AI_POLL_LOST_MESSAGE =
  "Status desain tidak bisa dimuat. Sesi mungkin habis atau koneksi bermasalah. Muat ulang halaman untuk melihat hasilnya; proses tetap berjalan dan kuota tidak terpotong bila gagal.";
