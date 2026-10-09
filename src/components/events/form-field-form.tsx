"use client";

import { useActionState, useEffect } from "react";
import { useWatch } from "react-hook-form";
import { toast } from "sonner";

import type { FormFieldState } from "@/app/organizer/events/[id]/form/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useActionForm } from "@/hooks/use-action-form";
import { FORM_FIELD_TYPES, formFieldSchema, type FormFieldTypeKey } from "@/lib/validation/form-field";

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

function FormFieldForm({
  action,
  idPrefix,
  defaultValues = EMPTY,
  submitLabel,
  successMessage,
  resetOnSuccess,
  submitVariant = "outline",
}: FormFieldFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const {
    form: {
      register,
      reset,
      control,
      formState: { errors },
    },
    onSubmit,
  } = useActionForm(formFieldSchema, {
    defaultValues: {
      label: defaultValues.label,
      type: defaultValues.type as FormFieldTypeKey,
      options: defaultValues.options,
      required: defaultValues.required === "on",
    },
    dispatch: formAction,
    serverErrors: state.errors,
  });
  const type = useWatch({ control, name: "type" });

  useEffect(() => {
    if (!state.savedAt) return;
    toast.success(successMessage);
    if (resetOnSuccess) reset();
  }, [state.savedAt, successMessage, resetOnSuccess, reset]);

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
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
            placeholder="Contoh: Asal instansi"
            aria-invalid={!!errors.label}
            className="h-10"
            {...register("label")}
          />
          <FieldError errors={[errors.label]} />
        </Field>
        <Field data-invalid={!!errors.type}>
          <FieldLabel htmlFor={`${idPrefix}-type`}>Tipe</FieldLabel>
          <NativeSelect id={`${idPrefix}-type`} aria-invalid={!!errors.type} className="h-10" {...register("type")}>
            {Object.entries(FORM_FIELD_TYPES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
          <FieldError errors={[errors.type]} />
        </Field>
      </div>
      {type !== "TEXT" ? (
        <Field data-invalid={!!errors.options}>
          <FieldLabel htmlFor={`${idPrefix}-options`}>Pilihan</FieldLabel>
          <Textarea
            id={`${idPrefix}-options`}
            rows={4}
            placeholder={"S\nM\nL\nXL"}
            aria-invalid={!!errors.options}
            {...register("options")}
          />
          <FieldDescription>Satu pilihan per baris.</FieldDescription>
          <FieldError errors={[errors.options]} />
        </Field>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex min-h-11 items-center gap-2.5 text-sm">
          <input type="checkbox" className="size-4 accent-primary" {...register("required")} />
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
