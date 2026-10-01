import { z } from "zod";

import { phoneSchema } from "@/lib/validation/phone";

export const organizerProfileSchema = z.object({
  orgName: z
    .string()
    .trim()
    .min(2, "Nama penyelenggara minimal 2 karakter.")
    .max(100, "Nama penyelenggara maksimal 100 karakter."),
  contactPhone: phoneSchema,
  contactEmail: z
    .string()
    .trim()
    .transform((value) => (value === "" ? undefined : value))
    .pipe(z.string().email("Email tidak valid.").optional()),
});

export type OrganizerProfileInput = z.infer<typeof organizerProfileSchema>;
