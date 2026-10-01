"use client";

import { useActionState } from "react";

import { joinOrganizer, type JoinOrganizerState } from "@/app/organizer/join/actions";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type JoinOrganizerFormProps = {
  defaultEmail: string;
};

function toErrors(messages?: string[]) {
  return messages?.map((message) => ({ message }));
}

function JoinOrganizerForm({ defaultEmail }: JoinOrganizerFormProps) {
  const [state, formAction, pending] = useActionState<JoinOrganizerState, FormData>(
    joinOrganizer,
    {},
  );

  return (
    <form action={formAction} noValidate>
      <FieldGroup>
        <Field data-invalid={!!state.errors?.orgName}>
          <FieldLabel htmlFor="orgName">Nama penyelenggara</FieldLabel>
          <Input
            id="orgName"
            name="orgName"
            required
            autoComplete="organization"
            defaultValue={state.values?.orgName}
            aria-invalid={!!state.errors?.orgName}
          />
          <FieldDescription>Tampil di halaman acara dan sertifikat.</FieldDescription>
          <FieldError errors={toErrors(state.errors?.orgName)} />
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
          />
          <FieldError errors={toErrors(state.errors?.contactPhone)} />
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
          />
          <FieldError errors={toErrors(state.errors?.contactEmail)} />
        </Field>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Menyimpan..." : "Aktifkan akun panitia"}
        </Button>
      </FieldGroup>
    </form>
  );
}

export { JoinOrganizerForm };
