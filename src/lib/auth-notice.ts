export type AuthNoticeTone = "error" | "success";

const NOTICES = {
  "verify-expired": {
    tone: "error",
    message:
      "Tautan verifikasi tidak berlaku atau sudah kedaluwarsa. Masuk dengan email dan passwordmu untuk mendapat tautan baru.",
  },
  account_not_linked: {
    tone: "error",
    message:
      "Email ini sudah dipakai untuk pendaftaran dengan password yang belum diverifikasi. Selesaikan verifikasi lewat email, atau atur ulang password.",
  },
  reset: {
    tone: "success",
    message: "Password sudah diperbarui. Silakan masuk dengan password baru.",
  },
} as const satisfies Record<string, { tone: AuthNoticeTone; message: string }>;

export type AuthNotice = keyof typeof NOTICES;

export function parseAuthNotice(...values: unknown[]): AuthNotice | null {
  for (const value of values) {
    if (typeof value === "string" && value in NOTICES) return value as AuthNotice;
  }
  return null;
}

export function describeAuthNotice(notice: AuthNotice) {
  return NOTICES[notice];
}
