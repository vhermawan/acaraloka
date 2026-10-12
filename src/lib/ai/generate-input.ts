import { z } from "zod";

import { STYLE_KEYS, type StyleKey } from "@/lib/ai/styles";
import { HEX_COLOR_PATTERN } from "@/lib/certificate-layout";

export const AI_NOTE_MAX_LENGTH = 150;
export const AI_BLOCKLIST_MESSAGE =
  "Keterangan tambahan tidak bisa diproses. Ubah keterangan lalu coba lagi. Kuota tidak berkurang.";

export const generateInputSchema = z.object({
  style: z.enum(STYLE_KEYS, { error: "Pilih salah satu gaya." }),
  colorHex: z
    .string()
    .trim()
    .refine((value) => value === "" || HEX_COLOR_PATTERN.test(value), "Warna harus berformat #RRGGBB."),
  note: z.string().trim().max(AI_NOTE_MAX_LENGTH, `Keterangan maksimal ${AI_NOTE_MAX_LENGTH} karakter.`),
});

export type GenerateInput = z.infer<typeof generateInputSchema>;

export const storedInputSchema = z.object({
  style: z.enum(STYLE_KEYS),
  colorHex: z.string().regex(HEX_COLOR_PATTERN).nullable(),
  note: z.string().max(AI_NOTE_MAX_LENGTH),
});

export type StoredInput = z.infer<typeof storedInputSchema>;

export function toStoredInput(input: GenerateInput): StoredInput {
  return { style: input.style, colorHex: input.colorHex === "" ? null : input.colorHex.toLowerCase(), note: input.note };
}

export const DEFAULT_STYLE: StyleKey = "formal-campus";

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_CONTENT_TYPES = { "image/png": "png", "image/jpeg": "jpg" } as const;
export const LOGO_INVALID_MESSAGE = "Logo harus PNG atau JPG, maksimal 2 MB.";
export const MAX_RESULT_HISTORY = 4;
