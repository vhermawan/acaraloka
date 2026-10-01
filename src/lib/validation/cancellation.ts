import { z } from "zod";

export const cancellationReasonSchema = z
  .string()
  .trim()
  .max(500, "Alasan maksimal 500 karakter.");

export function cancelEventSchema(eventTitle: string) {
  return z.object({
    reason: cancellationReasonSchema.min(5, "Tulis alasan pembatalan minimal 5 karakter."),
    confirmTitle: z
      .string()
      .trim()
      .refine((value) => value === eventTitle.trim(), "Ketik judul acara persis untuk konfirmasi."),
  });
}
