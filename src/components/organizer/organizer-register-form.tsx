"use client";

import { useActionState } from "react";

import { registerOrganizer, type OrganizerRegisterState } from "@/app/organizer/register/actions";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type OrganizerRegisterFormProps = {
  defaultEmail: string;
  next: string;
};

function toErrors(messages?: string[]) {
  return messages?.map((message) => ({ message }));
}

function OrganizerRegisterForm({ defaultEmail, next }: OrganizerRegisterFormProps) {
  const [state, formAction, pending] = useActionState<OrganizerRegisterState, FormData>(
    registerOrganizer,
    {},
  );

  return (
    <form action={formAction} noValidate>
      <FieldGroup>
        <input type="hidden" name="next" value={next} />
        {state.message ? (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {state.message}
          </p>
        ) : null}
        <Field data-invalid={!!state.errors?.orgName}>
          <FieldLabel htmlFor="orgName">Nama penyelenggara</FieldLabel>
          <Input
            id="orgName"
            name="orgName"
            required
            autoComplete="organization"
            defaultValue={state.values?.orgName}
            aria-invalid={!!state.errors?.orgName}
            className="h-10"
          />
          <FieldDescription>Tampil di halaman acara dan sertifikat.</FieldDescription>
          <FieldError errors={toErrors(state.errors?.orgName)} />
        </Field>
        <Field data-invalid={!!state.errors?.contactEmail}>
          <FieldLabel htmlFor="contactEmail">Email kontak (opsional)</FieldLabel>
          <Input
            id="contactEmail"
            name="contactEmail"
            type="email"
            autoComplete="email"
            defaultValue={state.values?.contactEmail ?? defaultEmail}
            aria-invalid={!!state.errors?.contactEmail}
            className="h-10"
          />
          <FieldError errors={toErrors(state.errors?.contactEmail)} />
        </Field>
        <Field data-invalid={!!state.errors?.contactPhone}>
          <FieldLabel htmlFor="contactPhone">Nomor HP kontak</FieldLabel>
          <Input
            id="contactPhone"
            name="contactPhone"
            type="tel"
            inputMode="tel"
            required
            autoComplete="tel"
            placeholder="081234567890"
            defaultValue={state.values?.contactPhone}
            aria-invalid={!!state.errors?.contactPhone}
            className="h-10"
          />
          <FieldError errors={toErrors(state.errors?.contactPhone)} />
        </Field>
        <Button type="submit" className="h-11 w-full" disabled={pending}>
          {pending ? "Menyimpan..." : "Buat akun panitia"}
        </Button>
      </FieldGroup>
    </form>
  );
}

export { OrganizerRegisterForm };
