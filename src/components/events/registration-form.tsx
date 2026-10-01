"use client";

import { useActionState } from "react";

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
import { answerKey, type RegistrationField } from "@/lib/validation/registration";

type TicketOption = { id: string; name: string; left: number };

type RegistrationFormProps = {
  action: (state: RegisterState, formData: FormData) => Promise<RegisterState>;
  tickets: TicketOption[];
  fields: RegistrationField[];
  defaults: { name: string; email: string; phone: string };
};

function toErrors(messages?: string[]) {
  return messages?.map((message) => ({ message }));
}

function RegistrationForm({ action, tickets, fields, defaults }: RegistrationFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const values: Record<string, string> = { ...defaults, ...state.values };
  const errors = state.errors ?? {};
  const firstAvailable = tickets.find((ticket) => ticket.left > 0)?.id ?? "";

  return (
    <form action={formAction} noValidate>
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
                    name="ticketTypeId"
                    value={ticket.id}
                    disabled={ticket.left === 0}
                    defaultChecked={(values.ticketTypeId ?? firstAvailable) === ticket.id}
                    className="size-4 accent-primary"
                  />
                  {ticket.name}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {ticket.left > 0 ? `Gratis · sisa ${ticket.left}` : "Habis"}
                </span>
              </label>
            ))}
          </div>
          <FieldError errors={toErrors(errors.ticketTypeId)} />
        </FieldSet>

        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="name">Nama lengkap</FieldLabel>
          <Input id="name" name="name" required autoComplete="name" defaultValue={values.name} aria-invalid={!!errors.name} />
          <FieldDescription>Dipakai di e-tiket dan sertifikat.</FieldDescription>
          <FieldError errors={toErrors(errors.name)} />
        </Field>
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            defaultValue={values.email}
            aria-invalid={!!errors.email}
          />
          <FieldError errors={toErrors(errors.email)} />
        </Field>
        <Field data-invalid={!!errors.phone}>
          <FieldLabel htmlFor="phone">Nomor HP</FieldLabel>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            required
            autoComplete="tel"
            placeholder="081234567890"
            defaultValue={values.phone}
            aria-invalid={!!errors.phone}
          />
          <FieldError errors={toErrors(errors.phone)} />
        </Field>

        {fields.map((field) => {
          const key = answerKey(field.id);
          const fieldErrors = errors[key];
          const label = `${field.label}${field.required ? "" : " (opsional)"}`;

          if (field.type === "SINGLE_CHOICE") {
            return (
              <FieldSet key={field.id} data-invalid={!!fieldErrors}>
                <FieldLegend variant="label">{label}</FieldLegend>
                <div className="flex flex-col gap-2">
                  {field.options.map((option) => (
                    <label key={option} className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name={key}
                        value={option}
                        defaultChecked={values[key] === option}
                        className="size-4 accent-primary"
                      />
                      {option}
                    </label>
                  ))}
                </div>
                <FieldError errors={toErrors(fieldErrors)} />
              </FieldSet>
            );
          }

          return (
            <Field key={field.id} data-invalid={!!fieldErrors}>
              <FieldLabel htmlFor={key}>{label}</FieldLabel>
              {field.type === "DROPDOWN" ? (
                <NativeSelect id={key} name={key} defaultValue={values[key] ?? ""} aria-invalid={!!fieldErrors}>
                  <option value="">Pilih</option>
                  {field.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </NativeSelect>
              ) : (
                <Input id={key} name={key} defaultValue={values[key]} aria-invalid={!!fieldErrors} />
              )}
              <FieldError errors={toErrors(fieldErrors)} />
            </Field>
          );
        })}

        <Field data-invalid={!!errors.consent}>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="consent" className="mt-0.5 size-4 shrink-0 accent-primary" />
            <span>
              Saya setuju data di atas dibagikan ke panitia acara ini untuk keperluan pendaftaran, check-in, dan
              sertifikat.
            </span>
          </label>
          <FieldError errors={toErrors(errors.consent)} />
        </Field>

        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Mendaftarkan..." : "Daftar"}
        </Button>
      </FieldGroup>
    </form>
  );
}

export { RegistrationForm };
