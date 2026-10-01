"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";

import type { TicketFormState } from "@/app/organizer/events/[id]/tickets/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type TicketTypeFormProps = {
  action: (state: TicketFormState, formData: FormData) => Promise<TicketFormState>;
  idPrefix: string;
  defaultValues?: { name: string; quota: string };
  submitLabel: string;
  successMessage: string;
  resetOnSuccess?: boolean;
  disabled?: boolean;
};

function toErrors(messages?: string[]) {
  return messages?.map((message) => ({ message }));
}

function TicketTypeForm({
  action,
  idPrefix,
  defaultValues = { name: "", quota: "" },
  submitLabel,
  successMessage,
  resetOnSuccess,
  disabled,
}: TicketTypeFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(action, {});
  const values = { ...defaultValues, ...state.values };
  const errors = state.errors ?? {};

  useEffect(() => {
    if (!state.savedAt) return;
    toast.success(successMessage);
    if (resetOnSuccess) formRef.current?.reset();
  }, [state.savedAt, successMessage, resetOnSuccess]);

  return (
    <form ref={formRef} action={formAction} noValidate className="flex flex-col gap-3">
      {state.message ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-start">
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor={`${idPrefix}-name`}>Nama tiket</FieldLabel>
          <Input
            id={`${idPrefix}-name`}
            name="name"
            required
            placeholder="Umum"
            defaultValue={values.name}
            disabled={disabled}
            aria-invalid={!!errors.name}
          />
          <FieldError errors={toErrors(errors.name)} />
        </Field>
        <Field data-invalid={!!errors.quota}>
          <FieldLabel htmlFor={`${idPrefix}-quota`}>Kuota</FieldLabel>
          <Input
            id={`${idPrefix}-quota`}
            name="quota"
            type="number"
            inputMode="numeric"
            min={1}
            required
            defaultValue={values.quota}
            disabled={disabled}
            aria-invalid={!!errors.quota}
            className="tabular-nums"
          />
          <FieldError errors={toErrors(errors.quota)} />
        </Field>
        <Button type="submit" variant="outline" disabled={disabled || pending} className="sm:mt-6">
          {pending ? "Menyimpan..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

export { TicketTypeForm };
