"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { AuthAlert } from "@/components/auth/auth-alert";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth-config";
import { classifySignUpError } from "@/lib/auth-errors";
import { checkEmailPath, continuePath, type UserRole } from "@/lib/roles";
import { signUpSchema } from "@/lib/validation/auth";

type SignUpFormProps = {
  role: UserRole;
  next: string;
};

const FIELD_IDS = { name: "signup-name", email: "signup-email", password: "signup-password", terms: "signup-terms" };

function SignUpForm({ role, next }: SignUpFormProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof signUpSchema>, unknown, z.output<typeof signUpSchema>>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", password: "", terms: false },
    mode: "onTouched",
  });
  const pending = isSubmitting || leaving;

  const onSubmit = handleSubmit(async ({ name, email, password }) => {
    setFormError(null);
    const body = {
      name,
      email,
      password,
      callbackURL: continuePath(role, next),
      intent: role,
      acceptTerms: true,
    };
    const { error } = await authClient.signUp.email(body);
    if (!error) {
      setLeaving(true);
      router.push(checkEmailPath(role, next, email));
      return;
    }

    const failure = classifySignUpError(error);
    if (failure.kind === "field") setError(failure.field, { type: "server", message: failure.message }, { shouldFocus: true });
    else setFormError(failure.message);
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        {formError ? <AuthAlert>{formError}</AuthAlert> : null}
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor={FIELD_IDS.name}>Nama lengkap</FieldLabel>
          <Input
            id={FIELD_IDS.name}
            autoComplete="name"
            placeholder="Nama sesuai identitas"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "signup-name-error" : undefined}
            className="h-10"
            {...register("name")}
          />
          <FieldError id="signup-name-error" errors={[errors.name]} />
        </Field>
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor={FIELD_IDS.email}>Email</FieldLabel>
          <Input
            id={FIELD_IDS.email}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="nama@email.com"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "signup-email-error" : undefined}
            className="h-10"
            {...register("email")}
          />
          <FieldError id="signup-email-error" errors={[errors.email]} />
        </Field>
        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor={FIELD_IDS.password}>Password</FieldLabel>
          <PasswordInput
            id={FIELD_IDS.password}
            autoComplete="new-password"
            placeholder="Buat password"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "signup-password-error" : "signup-password-hint"}
            className="h-10"
            {...register("password")}
          />
          <FieldDescription id="signup-password-hint">Minimal {MIN_PASSWORD_LENGTH} karakter.</FieldDescription>
          <FieldError id="signup-password-error" errors={[errors.password]} />
        </Field>
        <Field data-invalid={!!errors.terms}>
          <div className="flex items-start gap-2.5">
            <input
              id={FIELD_IDS.terms}
              type="checkbox"
              aria-invalid={!!errors.terms}
              aria-describedby={errors.terms ? "signup-terms-error" : undefined}
              className="mt-0.5 size-4 shrink-0 accent-primary"
              {...register("terms")}
            />
            <label htmlFor={FIELD_IDS.terms} className="text-sm/5 text-muted-foreground">
              Saya setuju dengan{" "}
              <Link
                href="/legal/terms"
                target="_blank"
                rel="noopener"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Syarat Layanan
              </Link>{" "}
              dan{" "}
              <Link
                href="/legal/privacy"
                target="_blank"
                rel="noopener"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Kebijakan Privasi
              </Link>
              .
            </label>
          </div>
          <FieldError id="signup-terms-error" errors={[errors.terms]} />
        </Field>
        <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
          {pending ? "Memproses..." : "Daftar"}
        </Button>
      </FieldGroup>
    </form>
  );
}

export { SignUpForm };
