import { z } from "zod";

import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/lib/auth-config";
import { isValidEmail, normalizeEmail } from "@/lib/auth-errors";

const PASSWORD_LENGTH_MESSAGE = `Password harus ${MIN_PASSWORD_LENGTH} sampai ${MAX_PASSWORD_LENGTH} karakter.`;

const emailSchema = z
  .string()
  .transform(normalizeEmail)
  .refine(isValidEmail, "Masukkan email yang valid.");

const newPasswordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, PASSWORD_LENGTH_MESSAGE)
  .max(MAX_PASSWORD_LENGTH, PASSWORD_LENGTH_MESSAGE);

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Masukkan password."),
});

export const signUpSchema = z.object({
  name: z.string().trim().min(1, "Masukkan nama lengkapmu."),
  email: emailSchema,
  password: newPasswordSchema,
  terms: z.boolean().refine((accepted) => accepted, "Setujui Syarat Layanan dan Kebijakan Privasi untuk mendaftar."),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  password: newPasswordSchema,
});
