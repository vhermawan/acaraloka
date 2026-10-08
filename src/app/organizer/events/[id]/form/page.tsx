import type { Metadata } from "next";
import { Lock } from "lucide-react";

import { FormFieldForm } from "@/components/events/form-field-form";
import { FormFieldRow } from "@/components/events/form-field-row";
import { FormPreview } from "@/components/events/form-preview";
import { ReadOnlyNotice } from "@/components/events/read-only-notice";
import { Badge } from "@/components/ui/badge";
import { FORM_FIELD_TYPES, type FormFieldTypeKey } from "@/lib/validation/form-field";
import { requireEventOwner } from "@/server/authz";
import { prisma } from "@/server/db";

import { createFormField, deleteFormField, moveFormField, updateFormField } from "./actions";

export const metadata: Metadata = {
  title: "Formulir acara",
};

const FIXED_FIELDS = ["Nama lengkap", "Email", "Nomor HP"];

function optionsOf(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function fieldMeta(type: string, required: boolean, options: string[]) {
  const parts = [FORM_FIELD_TYPES[type as FormFieldTypeKey] ?? type, required ? "wajib" : "opsional"];
  if (options.length) parts.push(options.join(", "));
  return parts.join(" · ");
}

export default async function EventFormPage({ params }: PageProps<"/organizer/events/[id]/form">) {
  const { id } = await params;
  const { event } = await requireEventOwner(id);
  const editable = event.status === "DRAFT" || event.status === "PUBLISHED";
  const fields = (await prisma.formField.findMany({ where: { eventId: event.id }, orderBy: { order: "asc" } })).map(
    (field) => ({ ...field, options: optionsOf(field.options) }),
  );

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-10">
      <div className="flex min-w-0 flex-col gap-8">
        <section aria-labelledby="form-heading" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="form-heading" className="text-lg/[26px] font-semibold">
              Formulir pendaftaran
            </h2>
            <p className="text-sm text-muted-foreground">
              Pertanyaan tambahan muncul setelah isian wajib, sesuai urutan di bawah.
            </p>
          </div>
          {editable ? null : (
            <ReadOnlyNotice>Formulir acara yang sudah dibatalkan atau dinonaktifkan tidak bisa diubah.</ReadOnlyNotice>
          )}
          <ol className="flex flex-col divide-y divide-border rounded-xl border border-border">
            {FIXED_FIELDS.map((label, index) => (
              <li key={label} className="flex items-center gap-4 bg-muted/40 px-4 py-3 first:rounded-t-xl">
                <span
                  aria-hidden="true"
                  className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground tabular-nums"
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 text-sm font-medium">{label}</span>
                <Badge variant="outline" className="gap-1 text-muted-foreground">
                  <Lock aria-hidden="true" />
                  Selalu ada
                </Badge>
              </li>
            ))}
            {fields.map((field, index) => (
              <FormFieldRow
                key={field.id}
                number={FIXED_FIELDS.length + index + 1}
                label={field.label}
                meta={fieldMeta(field.type, field.required, field.options)}
                editable={editable}
                isFirst={index === 0}
                isLast={index === fields.length - 1}
                moveUp={moveFormField.bind(null, event.id, field.id, "up")}
                moveDown={moveFormField.bind(null, event.id, field.id, "down")}
                remove={deleteFormField.bind(null, event.id, field.id)}
                editForm={
                  <FormFieldForm
                    key={field.updatedAt.toISOString()}
                    action={updateFormField.bind(null, event.id, field.id)}
                    idPrefix={`field-${field.id}`}
                    defaultValues={{
                      label: field.label,
                      type: field.type,
                      options: field.options.join("\n"),
                      required: field.required ? "on" : "",
                    }}
                    submitLabel="Simpan"
                    successMessage="Pertanyaan diperbarui."
                  />
                }
              />
            ))}
          </ol>
          {fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada pertanyaan tambahan. Peserta hanya mengisi nama, email, dan nomor HP.
            </p>
          ) : null}
        </section>

        {editable ? (
          <section aria-labelledby="new-field-heading" className="flex flex-col gap-4 border-t border-border pt-8">
            <h2 id="new-field-heading" className="text-lg/[26px] font-semibold">
              Tambah pertanyaan
            </h2>
            <FormFieldForm
              action={createFormField.bind(null, event.id)}
              idPrefix="new-field"
              submitLabel="Tambah"
              successMessage="Pertanyaan ditambahkan."
              submitVariant="default"
              resetOnSuccess
            />
          </section>
        ) : null}
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-8">
          <FormPreview fields={fields} />
        </div>
      </aside>
    </div>
  );
}
