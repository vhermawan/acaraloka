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
import { useActionForm } from "@/hooks/use-action-form";
import { organizerProfileSchema } from "@/lib/validation/organizer";

type OrganizerRegisterFormProps = {
  defaultEmail: string;
  next: string;
};

function OrganizerRegisterForm({ defaultEmail, next }: OrganizerRegisterFormProps) {
  const [state, formAction, pending] = useActionState<OrganizerRegisterState, FormData>(
    registerOrganizer,
    {},
  );
  const {
    form: {
      register,
      formState: { errors },
    },
    onSubmit,
  } = useActionForm(organizerProfileSchema, {
    defaultValues: { orgName: "", contactEmail: defaultEmail, contactPhone: "" },
    dispatch: formAction,
    serverErrors: state.errors,
  });

  return (
    <form onSubmit={onSubmit} noValidate>
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
        <Field data-invalid={!!errors.orgName}>
          <FieldLabel htmlFor="orgName">Nama penyelenggara</FieldLabel>
          <Input
            id="orgName"
            autoComplete="organization"
            placeholder="Contoh: Komunitas Desain Bandung"
            aria-invalid={!!errors.orgName}
            className="h-10"
            {...register("orgName")}
          />
          <FieldDescription>Tampil di halaman acara dan sertifikat.</FieldDescription>
          <FieldError errors={[errors.orgName]} />
        </Field>
        <Field data-invalid={!!errors.contactEmail}>
          <FieldLabel htmlFor="contactEmail">Email kontak (opsional)</FieldLabel>
          <Input
            id="contactEmail"
            type="email"
            autoComplete="email"
            placeholder="panitia@email.com"
            aria-invalid={!!errors.contactEmail}
            className="h-10"
            {...register("contactEmail")}
          />
          <FieldError errors={[errors.contactEmail]} />
        </Field>
        <Field data-invalid={!!errors.contactPhone}>
          <FieldLabel htmlFor="contactPhone">Nomor HP kontak</FieldLabel>
          <Input
            id="contactPhone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="081234567890"
            aria-invalid={!!errors.contactPhone}
            className="h-10"
            {...register("contactPhone")}
          />
          <FieldError errors={[errors.contactPhone]} />
        </Field>
        <Button type="submit" className="h-11 w-full" disabled={pending}>
          {pending ? "Menyimpan..." : "Buat akun panitia"}
        </Button>
      </FieldGroup>
    </form>
  );
}

export { OrganizerRegisterForm };
