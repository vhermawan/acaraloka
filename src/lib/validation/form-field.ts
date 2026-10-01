import { z } from "zod";

export const FORM_FIELD_TYPES = {
  TEXT: "Teks",
  SINGLE_CHOICE: "Pilihan tunggal",
  DROPDOWN: "Dropdown",
} as const;

export type FormFieldTypeKey = keyof typeof FORM_FIELD_TYPES;

export const RESERVED_FIELD_LABELS = ["nama", "nama lengkap", "email", "e-mail", "hp", "no hp", "nomor hp", "telepon"];

function parseOptions(raw: string): string[] {
  const seen = new Set<string>();
  return raw
    .split("\n")
    .map((option) => option.trim())
    .filter((option) => {
      const key = option.toLowerCase();
      if (!option || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export const formFieldSchema = z
  .object({
    label: z.string().trim().min(2, "Label minimal 2 karakter.").max(80, "Label maksimal 80 karakter."),
    type: z.enum(Object.keys(FORM_FIELD_TYPES) as [FormFieldTypeKey, ...FormFieldTypeKey[]], {
      message: "Pilih tipe isian.",
    }),
    required: z.boolean(),
    options: z.string().default(""),
  })
  .transform((data, ctx) => {
    if (RESERVED_FIELD_LABELS.includes(data.label.toLowerCase())) {
      ctx.addIssue({
        code: "custom",
        path: ["label"],
        message: "Nama, email, dan nomor HP sudah selalu ditanyakan.",
      });
    }
    const options = data.type === "TEXT" ? [] : parseOptions(data.options);
    if (data.type !== "TEXT" && options.length < 2) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Isi minimal 2 pilihan, satu per baris." });
    }
    if (options.length > 30) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Maksimal 30 pilihan." });
    }
    if (options.some((option) => option.length > 80)) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Setiap pilihan maksimal 80 karakter." });
    }
    return { label: data.label, type: data.type, required: data.required, options };
  });

export type FormFieldInput = z.infer<typeof formFieldSchema>;
