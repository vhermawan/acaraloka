import { z } from "zod";

import { EVENT_TIMEZONE_IDS, localInputToDate } from "@/lib/timezone";

export const POSTER_MAX_BYTES = 2 * 1024 * 1024;
export const POSTER_CONTENT_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type PosterContentType = keyof typeof POSTER_CONTENT_TYPES;

export const eventFormSchema = z
  .object({
    title: z.string().trim().min(3, "Judul minimal 3 karakter.").max(120, "Judul maksimal 120 karakter."),
    description: z
      .string()
      .trim()
      .min(10, "Deskripsi minimal 10 karakter.")
      .max(5000, "Deskripsi maksimal 5000 karakter."),
    timezone: z.enum(EVENT_TIMEZONE_IDS, { message: "Pilih zona waktu." }),
    startAt: z.string(),
    endAt: z.string(),
    venue: z.string().trim().min(3, "Isi lokasi atau tautan acara.").max(300, "Lokasi maksimal 300 karakter."),
  })
  .transform((data, ctx) => {
    const startAt = localInputToDate(data.startAt, data.timezone);
    const endAt = localInputToDate(data.endAt, data.timezone);
    if (!startAt) ctx.addIssue({ code: "custom", path: ["startAt"], message: "Isi waktu mulai." });
    if (!endAt) ctx.addIssue({ code: "custom", path: ["endAt"], message: "Isi waktu selesai." });
    if (startAt && endAt && endAt <= startAt) {
      ctx.addIssue({ code: "custom", path: ["endAt"], message: "Waktu selesai harus setelah waktu mulai." });
    }
    if (!startAt || !endAt) return z.NEVER;
    return { ...data, startAt, endAt };
  });

export type EventFormInput = z.infer<typeof eventFormSchema>;

export function validatePosterFile(contentType: string, size: number): string | null {
  if (!(contentType in POSTER_CONTENT_TYPES)) return "Poster harus berformat JPG, PNG, atau WebP.";
  if (size <= 0 || size > POSTER_MAX_BYTES) return "Ukuran poster maksimal 2 MB.";
  return null;
}
