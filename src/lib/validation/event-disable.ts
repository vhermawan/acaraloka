import { z } from "zod";

export const disableReasonSchema = z
  .string()
  .trim()
  .min(5, "Tulis alasan penonaktifan minimal 5 karakter.")
  .max(500, "Alasan maksimal 500 karakter.");
