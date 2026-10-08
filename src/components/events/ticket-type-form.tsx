"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { cn } from "cn";

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
  hideLabelsOnDesktop?: boolean;
  submitVariant?: "default" | "outline";
  children?: React.ReactNode;
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
  hideLabelsOnDesktop,
  submitVariant = "outline",
  children,
}: TicketTypeFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(action, {});
  const values = { ...defaultValues, ...state.values };
  const errors = state.errors ?? {};
  const labelClass = cn(hideLabelsOnDesktop && "sm:sr-only");

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
      <div
        className={cn(
          "grid gap-3",
          hideLabelsOnDesktop
            ? "sm:grid-cols-[minmax(0,1fr)_7rem_9rem] sm:items-start"
            : "sm:grid-cols-[minmax(0,1fr)_7rem_auto] sm:items-end",
        )}
      >
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor={`${idPrefix}-name`} className={labelClass}>
            Nama tiket
          </FieldLabel>
          <Input
            id={`${idPrefix}-name`}
            name="name"
            required
            placeholder="Umum"
            defaultValue={values.name}
            disabled={disabled}
            aria-invalid={!!errors.name}
            className="h-10"
          />
          <FieldError errors={toErrors(errors.name)} />
        </Field>
        <Field data-invalid={!!errors.quota}>
          <FieldLabel htmlFor={`${idPrefix}-quota`} className={labelClass}>
            Kuota
          </FieldLabel>
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
            className="h-10 tabular-nums"
          />
          <FieldError errors={toErrors(errors.quota)} />
        </Field>
        <div className="flex items-center gap-1">
          <Button type="submit" variant={submitVariant} disabled={disabled || pending} className="h-10 px-4">
            {pending ? "Menyimpan..." : submitLabel}
          </Button>
          {children}
        </div>
      </div>
    </form>
  );
}

export { TicketTypeForm };
