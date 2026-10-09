export const FLASH_COOKIE = "flash";
export const FLASH_MAX_AGE_SECONDS = 60;

const FLASH_MESSAGES = {
  "event-created": "Acara berhasil dibuat. Lanjutkan dengan menambah tiket.",
  "registration-created": "Pendaftaran berhasil. Ini e-tiketmu.",
  "organizer-created": "Akun panitia berhasil dibuat.",
} as const;

export type FlashKey = keyof typeof FLASH_MESSAGES;

export function flashMessage(value: unknown): string | null {
  if (typeof value !== "string" || !Object.hasOwn(FLASH_MESSAGES, value)) return null;
  return FLASH_MESSAGES[value as FlashKey];
}
