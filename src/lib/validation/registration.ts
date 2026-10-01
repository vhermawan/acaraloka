import { z } from "zod";

import { phoneSchema } from "@/lib/validation/phone";

export type RegistrationField = {
  id: string;
  label: string;
  type: "TEXT" | "SINGLE_CHOICE" | "DROPDOWN";
  required: boolean;
  options: string[];
};

export type RegistrationAnswer = { fieldId: string; label: string; value: string };

export function answerKey(fieldId: string) {
  return `field_${fieldId}`;
}

function answerSchema(field: RegistrationField) {
  const base = z.string().trim().max(500, "Jawaban maksimal 500 karakter.");
  const choice = field.type === "TEXT" ? base : base.refine((value) => value === "" || field.options.includes(value), "Pilihan tidak valid.");
  return field.required ? choice.refine((value) => value !== "", "Wajib diisi.") : choice;
}

export function buildRegistrationSchema(fields: RegistrationField[], ticketTypeIds: string[]) {
  const answerShape = Object.fromEntries(fields.map((field) => [answerKey(field.id), answerSchema(field)]));

  return z
    .object({
      ticketTypeId: z.string().refine((value) => ticketTypeIds.includes(value), "Pilih jenis tiket."),
      name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(100, "Nama maksimal 100 karakter."),
      email: z.string().trim().toLowerCase().email("Email tidak valid."),
      phone: phoneSchema,
      consent: z.literal("on", { message: "Kamu perlu menyetujui penggunaan data untuk acara ini." }),
      ...answerShape,
    })
    .transform((data) => {
      const record = data as Record<string, string>;
      const answers: RegistrationAnswer[] = fields.map((field) => ({
        fieldId: field.id,
        label: field.label,
        value: record[answerKey(field.id)] ?? "",
      }));
      return { ticketTypeId: data.ticketTypeId, name: data.name, email: data.email, phone: data.phone, answers };
    });
}
