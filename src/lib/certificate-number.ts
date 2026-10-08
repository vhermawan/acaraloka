import { randomInt } from "node:crypto";

import { CERTIFICATE_NUMBER_PREFIX } from "@/lib/brand";

export const CERTIFICATE_SUFFIX_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
export const CERTIFICATE_SUFFIX_LENGTH = 6;

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

export function certificateSuffix(): string {
  let suffix = "";
  for (let index = 0; index < CERTIFICATE_SUFFIX_LENGTH; index += 1) {
    suffix += CERTIFICATE_SUFFIX_ALPHABET[randomInt(CERTIFICATE_SUFFIX_ALPHABET.length)];
  }
  return suffix;
}

export function certificateYearMonth(date: Date): string {
  const shifted = new Date(date.getTime() + WIB_OFFSET_MS);
  const year = String(shifted.getUTCFullYear() % 100).padStart(2, "0");
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  return `${year}${month}`;
}

export function buildCertificateNumber(input: { date: Date; seq: number; suffix?: string }): string {
  const seq = String(input.seq).padStart(4, "0");
  return `${CERTIFICATE_NUMBER_PREFIX}-${certificateYearMonth(input.date)}-${seq}-${input.suffix ?? certificateSuffix()}`;
}
