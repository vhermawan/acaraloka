"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { cn } from "cn";

import type { TicketFormState } from "@/app/organizer/events/[id]/tickets/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useActionForm } from "@/hooks/use-action-form";
import { ticketTypeSchema } from "@/lib/validation/ticket";

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
  const [state, formAction, pending] = useActionState(action, {});
  const {
    form: {
      register,
      reset,
      formState: { errors },
    },
    onSubmit,
  } = useActionForm(ticketTypeSchema, {
    defaultValues,
    dispatch: formAction,
    serverErrors: state.errors,
  });
  const labelClass = cn(hideLabelsOnDesktop && "sm:sr-only");

  useEffect(() => {
    if (!state.savedAt) return;
    toast.success(successMessage);
    if (resetOnSuccess) reset();
  }, [state.savedAt, successMessage, resetOnSuccess, reset]);

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
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
            placeholder="Contoh: Umum atau Mahasiswa"
            disabled={disabled}
            aria-invalid={!!errors.name}
            className="h-10"
            {...register("name")}
          />
          <FieldError errors={[errors.name]} />
        </Field>
        <Field data-invalid={!!errors.quota}>
          <FieldLabel htmlFor={`${idPrefix}-quota`} className={labelClass}>
            Kuota
          </FieldLabel>
          <Input
            id={`${idPrefix}-quota`}
            type="number"
            inputMode="numeric"
            min={1}
            placeholder="100"
            disabled={disabled}
            aria-invalid={!!errors.quota}
            className="h-10 tabular-nums"
            {...register("quota")}
          />
          <FieldError errors={[errors.quota]} />
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
