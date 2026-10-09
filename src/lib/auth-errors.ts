type AuthClientError = { status?: number; code?: string } | null | undefined;

export const AUTH_FALLBACK_ERROR = "Terjadi kendala. Coba lagi sebentar lagi.";
export const AUTH_RATE_LIMIT_ERROR = "Terlalu banyak percobaan. Tunggu beberapa menit, lalu coba lagi.";

export type AuthFailure =
  | { kind: "unverified" }
  | { kind: "rate-limited"; message: string }
  | { kind: "field"; field: "email" | "password" | "terms"; message: string }
  | { kind: "form"; message: string };

export function classifySignInError(error: AuthClientError): AuthFailure {
  if (error?.status === 429) return { kind: "rate-limited", message: AUTH_RATE_LIMIT_ERROR };
  if (error?.code === "EMAIL_NOT_VERIFIED") return { kind: "unverified" };
  if (error?.code === "ACCOUNT_DISABLED") {
    return { kind: "form", message: "Akun ini dinonaktifkan. Hubungi admin jika menurutmu ini keliru." };
  }
  if (error?.code === "INVALID_EMAIL_OR_PASSWORD") {
    return {
      kind: "form",
      message: "Email atau password salah. Kalau kamu mendaftar dengan Google, masuk lewat tombol Google.",
    };
  }
  return { kind: "form", message: AUTH_FALLBACK_ERROR };
}

export type FormFailure = Exclude<AuthFailure, { kind: "unverified" }>;

export function classifySignUpError(error: AuthClientError): FormFailure {
  if (error?.status === 429) return { kind: "rate-limited", message: AUTH_RATE_LIMIT_ERROR };
  switch (error?.code) {
    case "PASSWORD_TOO_SHORT":
    case "PASSWORD_TOO_LONG":
    case "INVALID_PASSWORD":
      return { kind: "field", field: "password", message: "Password harus 8 sampai 128 karakter." };
    case "INVALID_EMAIL":
      return { kind: "field", field: "email", message: "Format email belum benar." };
    case "TERMS_NOT_ACCEPTED":
      return { kind: "field", field: "terms", message: "Setujui Syarat Layanan dan Kebijakan Privasi untuk mendaftar." };
    default:
      return { kind: "form", message: AUTH_FALLBACK_ERROR };
  }
}

export function classifyResetError(error: AuthClientError): FormFailure {
  if (error?.status === 429) return { kind: "rate-limited", message: AUTH_RATE_LIMIT_ERROR };
  switch (error?.code) {
    case "INVALID_TOKEN":
      return { kind: "form", message: "Tautan atur ulang password tidak berlaku atau sudah dipakai. Minta tautan baru." };
    case "PASSWORD_TOO_SHORT":
    case "PASSWORD_TOO_LONG":
      return { kind: "field", field: "password", message: "Password harus 8 sampai 128 karakter." };
    default:
      return { kind: "form", message: AUTH_FALLBACK_ERROR };
  }
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}
