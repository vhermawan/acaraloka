import { z } from "zod";

export const revokeReasonSchema = z
  .string()
  .trim()
  .min(5, "Tulis alasan pencabutan minimal 5 karakter.")
  .max(300, "Alasan maksimal 300 karakter.");
