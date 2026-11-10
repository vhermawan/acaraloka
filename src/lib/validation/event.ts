import { z } from "zod";

import { LOCATION_TYPES, hasOnlineMeeting, hasPhysicalVenue } from "@/lib/event-location";
import { parseHttpsUrl } from "@/lib/meeting-provider";
import {
  DESCRIPTION_MAX_HTML,
  DESCRIPTION_MAX_IMAGES,
  DESCRIPTION_MAX_TEXT,
  DESCRIPTION_MIN_TEXT,
  countDescriptionImages,
  descriptionToText,
} from "@/lib/rich-text";
import { EVENT_TIMEZONE_IDS, localInputToDate } from "@/lib/timezone";

export const POSTER_MAX_BYTES = 2 * 1024 * 1024;
export const POSTER_CONTENT_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type PosterContentType = keyof typeof POSTER_CONTENT_TYPES;

const descriptionSchema = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    const length = descriptionToText(value).length;
    if (length < DESCRIPTION_MIN_TEXT) {
      ctx.addIssue({ code: "custom", message: `Deskripsi minimal ${DESCRIPTION_MIN_TEXT} karakter.` });
    } else if (length > DESCRIPTION_MAX_TEXT) {
      ctx.addIssue({ code: "custom", message: `Deskripsi maksimal ${DESCRIPTION_MAX_TEXT} karakter.` });
    }
    if (value.length > DESCRIPTION_MAX_HTML) {
      ctx.addIssue({ code: "custom", message: "Deskripsi terlalu panjang. Kurangi teks atau gambar." });
    }
    if (countDescriptionImages(value) > DESCRIPTION_MAX_IMAGES) {
      ctx.addIssue({ code: "custom", message: `Maksimal ${DESCRIPTION_MAX_IMAGES} gambar di deskripsi.` });
    }
  });

export const eventFormSchema = z
  .object({
    title: z.string().trim().min(3, "Judul minimal 3 karakter.").max(120, "Judul maksimal 120 karakter."),
    description: descriptionSchema,
    timezone: z.enum(EVENT_TIMEZONE_IDS, { message: "Pilih zona waktu." }),
    startAt: z.string(),
    endAt: z.string(),
    locationType: z.enum(LOCATION_TYPES, { message: "Pilih jenis lokasi." }),
    venueName: z.string().trim().max(200, "Nama tempat maksimal 200 karakter."),
    venueAddress: z.string().trim().max(300, "Alamat maksimal 300 karakter."),
    placeId: z.string().trim().max(300).regex(/^[A-Za-z0-9_-]*$/, "Tempat tidak valid."),
    onlineUrl: z.string().trim().max(500, "Tautan maksimal 500 karakter."),
  })
  .transform((data, ctx) => {
    const startAt = localInputToDate(data.startAt, data.timezone);
    const endAt = localInputToDate(data.endAt, data.timezone);
    if (!startAt) ctx.addIssue({ code: "custom", path: ["startAt"], message: "Isi waktu mulai." });
    if (!endAt) ctx.addIssue({ code: "custom", path: ["endAt"], message: "Isi waktu selesai." });
    if (startAt && endAt && endAt <= startAt) {
      ctx.addIssue({ code: "custom", path: ["endAt"], message: "Waktu selesai harus setelah waktu mulai." });
    }
    const physical = hasPhysicalVenue(data.locationType);
    const online = hasOnlineMeeting(data.locationType);
    if (physical && data.venueName.length < 3) {
      ctx.addIssue({ code: "custom", path: ["venueName"], message: "Isi nama tempat, minimal 3 karakter." });
    }
    if (online && !data.onlineUrl) {
      ctx.addIssue({ code: "custom", path: ["onlineUrl"], message: "Isi tautan meeting." });
    } else if (online && !parseHttpsUrl(data.onlineUrl)) {
      ctx.addIssue({ code: "custom", path: ["onlineUrl"], message: "Tautan harus diawali https:// dan valid." });
    }
    if (!startAt || !endAt) return z.NEVER;
    const { venueName, venueAddress, placeId, onlineUrl, ...rest } = data;
    return {
      ...rest,
      startAt,
      endAt,
      venueName: physical ? venueName : null,
      venueAddress: physical ? venueAddress || null : null,
      placeId: physical ? placeId || null : null,
      onlineUrl: online ? onlineUrl : null,
    };
  });

export type EventFormInput = z.infer<typeof eventFormSchema>;

export function validatePosterFile(contentType: string, size: number): string | null {
  if (!(contentType in POSTER_CONTENT_TYPES)) return "Poster harus berformat JPG, PNG, atau WebP.";
  if (size <= 0 || size > POSTER_MAX_BYTES) return "Ukuran poster maksimal 2 MB.";
  return null;
}
