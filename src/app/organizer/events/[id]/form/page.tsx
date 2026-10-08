import type { Metadata } from "next";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";

import { FormFieldForm } from "@/components/events/form-field-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FORM_FIELD_TYPES, type FormFieldTypeKey } from "@/lib/validation/form-field";
import { requireEventOwner } from "@/server/authz";
import { prisma } from "@/server/db";

import { createFormField, deleteFormField, moveFormField, updateFormField } from "./actions";

export const metadata: Metadata = {
  title: "Formulir acara | Hadirly",
};

const FIXED_FIELDS = ["Nama lengkap", "Email", "Nomor HP"];

function optionsOf(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export default async function EventFormPage({ params }: PageProps<"/organizer/events/[id]/form">) {
  const { id } = await params;
  const { event } = await requireEventOwner(id);
  const editable = event.status === "DRAFT" || event.status === "PUBLISHED";
  const fields = await prisma.formField.findMany({ where: { eventId: event.id }, orderBy: { order: "asc" } });

  return (
    <div className="flex max-w-3xl flex-col gap-10">
      <section aria-labelledby="form-heading" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="form-heading" className="font-medium">Formulir pendaftaran</h2>
          <p className="text-sm text-muted-foreground">
            Pertanyaan tambahan muncul setelah isian wajib, sesuai urutan di bawah.
          </p>
        </div>
        <ol className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {FIXED_FIELDS.map((label) => (
            <li key={label} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span>{label}</span>
              <Badge variant="outline">Selalu ada</Badge>
            </li>
          ))}
          {fields.map((field, index) => {
            const options = optionsOf(field.options);
            return (
              <li key={field.id} className="flex flex-col gap-3 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-medium">{field.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {FORM_FIELD_TYPES[field.type as FormFieldTypeKey]}
                      {field.required ? " · wajib" : " · opsional"}
                      {options.length ? ` · ${options.join(", ")}` : ""}
                    </span>
                  </div>
                  {editable ? (
                    <div className="flex items-center gap-1">
                      <form action={moveFormField.bind(null, event.id, field.id, "up")}>
                        <Button type="submit" variant="ghost" size="icon-sm" disabled={index === 0} aria-label={`Naikkan ${field.label}`}>
                          <ArrowUpIcon />
                        </Button>
                      </form>
                      <form action={moveFormField.bind(null, event.id, field.id, "down")}>
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon-sm"
                          disabled={index === fields.length - 1}
                          aria-label={`Turunkan ${field.label}`}
                        >
                          <ArrowDownIcon />
                        </Button>
                      </form>
                      <form action={deleteFormField.bind(null, event.id, field.id)}>
                        <Button type="submit" variant="ghost" size="sm">
                          Hapus
                        </Button>
                      </form>
                    </div>
                  ) : null}
                </div>
                {editable ? (
                  <details className="group">
                    <summary className="w-fit cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                      Ubah
                    </summary>
                    <div className="pt-4">
                      <FormFieldForm
                        key={field.updatedAt.toISOString()}
                        action={updateFormField.bind(null, event.id, field.id)}
                        idPrefix={`field-${field.id}`}
                        defaultValues={{
                          label: field.label,
                          type: field.type,
                          options: options.join("\n"),
                          required: field.required ? "on" : "",
                        }}
                        submitLabel="Simpan"
                        successMessage="Pertanyaan diperbarui."
                      />
                    </div>
                  </details>
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>

      {editable ? (
        <section aria-labelledby="new-field-heading" className="flex flex-col gap-4 border-t border-border pt-8">
          <h2 id="new-field-heading" className="font-medium">Tambah pertanyaan</h2>
          <FormFieldForm
            action={createFormField.bind(null, event.id)}
            idPrefix="new-field"
            submitLabel="Tambah"
            successMessage="Pertanyaan ditambahkan."
            resetOnSuccess
          />
        </section>
      ) : null}
    </div>
  );
}
