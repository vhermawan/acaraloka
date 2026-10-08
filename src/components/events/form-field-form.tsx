"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { FormFieldState } from "@/app/organizer/events/[id]/form/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FORM_FIELD_TYPES } from "@/lib/validation/form-field";

type FormFieldValues = {
  label: string;
  type: string;
  options: string;
  required: string;
};

type FormFieldFormProps = {
  action: (state: FormFieldState, formData: FormData) => Promise<FormFieldState>;
  idPrefix: string;
  defaultValues?: FormFieldValues;
  submitLabel: string;
  successMessage: string;
  resetOnSuccess?: boolean;
  submitVariant?: "default" | "outline";
};

const EMPTY: FormFieldValues = { label: "", type: "TEXT", options: "", required: "" };

function toErrors(messages?: string[]) {
  return messages?.map((message) => ({ message }));
}

function FormFieldForm({
  action,
  idPrefix,
  defaultValues = EMPTY,
  submitLabel,
  successMessage,
  resetOnSuccess,
  submitVariant = "outline",
}: FormFieldFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(action, {});
  const values = { ...defaultValues, ...state.values };
  const errors = state.errors ?? {};
  const [type, setType] = useState(values.type);

  useEffect(() => {
    if (!state.savedAt) return;
    toast.success(successMessage);
    if (resetOnSuccess) formRef.current?.reset();
  }, [state.savedAt, successMessage, resetOnSuccess]);

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      onReset={() => setType(defaultValues.type)}
      className="flex flex-col gap-4"
    >
      {state.message ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={!!errors.label}>
          <FieldLabel htmlFor={`${idPrefix}-label`}>Pertanyaan</FieldLabel>
          <Input
            id={`${idPrefix}-label`}
            name="label"
            required
            placeholder="Asal instansi"
            defaultValue={values.label}
            aria-invalid={!!errors.label}
            className="h-10"
          />
          <FieldError errors={toErrors(errors.label)} />
        </Field>
        <Field data-invalid={!!errors.type}>
          <FieldLabel htmlFor={`${idPrefix}-type`}>Tipe</FieldLabel>
          <NativeSelect
            id={`${idPrefix}-type`}
            name="type"
            value={type}
            onChange={(event) => setType(event.target.value)}
            className="h-10"
          >
            {Object.entries(FORM_FIELD_TYPES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
          <FieldError errors={toErrors(errors.type)} />
        </Field>
      </div>
      {type !== "TEXT" ? (
        <Field data-invalid={!!errors.options}>
          <FieldLabel htmlFor={`${idPrefix}-options`}>Pilihan</FieldLabel>
          <Textarea
            id={`${idPrefix}-options`}
            name="options"
            rows={4}
            placeholder={"S\nM\nL\nXL"}
            defaultValue={values.options}
            aria-invalid={!!errors.options}
          />
          <FieldDescription>Satu pilihan per baris.</FieldDescription>
          <FieldError errors={toErrors(errors.options)} />
        </Field>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex min-h-11 items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            name="required"
            defaultChecked={values.required === "on"}
            className="size-4 accent-primary"
          />
          Wajib diisi
        </label>
        <Button type="submit" variant={submitVariant} disabled={pending} className="h-10 px-4">
          {pending ? "Menyimpan..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

export { FormFieldForm };
