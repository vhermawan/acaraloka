"use client";

import { useActionState, useMemo } from "react";

import type { RegisterState } from "@/app/e/[slug]/register/actions";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useActionForm } from "@/hooks/use-action-form";
import { answerKey, buildRegistrationSchema, type RegistrationField } from "@/lib/validation/registration";

type TicketOption = { id: string; name: string; left: number };

type RegistrationFormProps = {
  action: (state: RegisterState, formData: FormData) => Promise<RegisterState>;
  tickets: TicketOption[];
  fields: RegistrationField[];
  defaults: { name: string; email: string; phone: string };
};

function RegistrationForm({ action, tickets, fields, defaults }: RegistrationFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const schema = useMemo(
    () =>
      buildRegistrationSchema(
        fields,
        tickets.map((ticket) => ticket.id),
      ),
    [fields, tickets],
  );
  const {
    form: {
      register,
      formState: { errors },
    },
    onSubmit,
  } = useActionForm(schema, {
    defaultValues: {
      ticketTypeId: tickets.find((ticket) => ticket.left > 0)?.id ?? "",
      ...defaults,
      ...Object.fromEntries(fields.map((field) => [answerKey(field.id), ""])),
    },
    dispatch: formAction,
    serverErrors: state.errors,
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        {state.message ? (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {state.message}
          </p>
        ) : null}

        <FieldSet data-invalid={!!errors.ticketTypeId}>
          <FieldLegend variant="label">Jenis tiket</FieldLegend>
          <div className="flex flex-col gap-2">
            {tickets.map((ticket) => (
              <label
                key={ticket.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm has-checked:border-primary has-disabled:opacity-50"
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    value={ticket.id}
                    disabled={ticket.left === 0}
                    className="size-4 accent-primary"
                    {...register("ticketTypeId")}
                  />
                  {ticket.name}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {ticket.left > 0 ? `Gratis · sisa ${ticket.left}` : "Habis"}
                </span>
              </label>
            ))}
          </div>
          <FieldError errors={[errors.ticketTypeId]} />
        </FieldSet>

        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="name">Nama lengkap</FieldLabel>
          <Input
            id="name"
            autoComplete="name"
            placeholder="Nama lengkap untuk e-tiket dan sertifikat"
            aria-invalid={!!errors.name}
            {...register("name")}
          />
          <FieldDescription>Dipakai di e-tiket dan sertifikat.</FieldDescription>
          <FieldError errors={[errors.name]} />
        </Field>
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="nama@email.com"
            aria-invalid={!!errors.email}
            {...register("email")}
          />
          <FieldError errors={[errors.email]} />
        </Field>
        <Field data-invalid={!!errors.phone}>
          <FieldLabel htmlFor="phone">Nomor HP</FieldLabel>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="081234567890"
            aria-invalid={!!errors.phone}
            {...register("phone")}
          />
          <FieldError errors={[errors.phone]} />
        </Field>

        {fields.map((field) => {
          const key = answerKey(field.id);
          const fieldError = errors[key];
          const label = `${field.label}${field.required ? "" : " (opsional)"}`;

          if (field.type === "SINGLE_CHOICE") {
            return (
              <FieldSet key={field.id} data-invalid={!!fieldError}>
                <FieldLegend variant="label">{label}</FieldLegend>
                <div className="flex flex-col gap-2">
                  {field.options.map((option) => (
                    <label key={option} className="flex items-center gap-2 text-sm">
                      <input type="radio" value={option} className="size-4 accent-primary" {...register(key)} />
                      {option}
                    </label>
                  ))}
                </div>
                <FieldError errors={[fieldError]} />
              </FieldSet>
            );
          }

          return (
            <Field key={field.id} data-invalid={!!fieldError}>
              <FieldLabel htmlFor={key}>{label}</FieldLabel>
              {field.type === "DROPDOWN" ? (
                <NativeSelect id={key} aria-invalid={!!fieldError} {...register(key)}>
                  <option value="">Pilih</option>
                  {field.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </NativeSelect>
              ) : (
                <Input id={key} placeholder="Tulis jawabanmu" aria-invalid={!!fieldError} {...register(key)} />
              )}
              <FieldError errors={[fieldError]} />
            </Field>
          );
        })}

        <Field data-invalid={!!errors.consent}>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" value="on" className="mt-0.5 size-4 shrink-0 accent-primary" {...register("consent")} />
            <span>
              Saya setuju data di atas dibagikan ke panitia acara ini untuk keperluan pendaftaran, check-in, dan
              sertifikat.
            </span>
          </label>
          <FieldError errors={[errors.consent]} />
        </Field>

        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Mendaftarkan..." : "Daftar"}
        </Button>
      </FieldGroup>
    </form>
  );
}

export { RegistrationForm };
