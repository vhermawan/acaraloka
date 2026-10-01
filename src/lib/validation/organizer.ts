import { z } from "zod";

export const organizerProfileSchema = z.object({
  orgName: z
    .string()
    .trim()
    .min(2, "Nama penyelenggara minimal 2 karakter.")
    .max(100, "Nama penyelenggara maksimal 100 karakter."),
  contactPhone: z
    .string()
    .trim()
    .transform((value) => value.replace(/[\s-]/g, ""))
    .pipe(z.string().regex(/^(\+62|62|0)8\d{7,12}$/, "Nomor HP tidak valid. Contoh: 081234567890.")),
  contactEmail: z
    .string()
    .trim()
    .transform((value) => (value === "" ? undefined : value))
    .pipe(z.string().email("Email tidak valid.").optional()),
});

export type OrganizerProfileInput = z.infer<typeof organizerProfileSchema>;
