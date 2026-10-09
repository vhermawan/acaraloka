"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthAlert } from "@/components/auth/auth-alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/lib/auth-config";
import { classifySignUpError, isValidEmail, normalizeEmail } from "@/lib/auth-errors";
import { checkEmailPath, continuePath, type UserRole } from "@/lib/roles";

type SignUpFormProps = {
  role: UserRole;
  next: string;
};

type Errors = { name?: string; email?: string; password?: string; terms?: string; form?: string };

const FIELD_IDS = { name: "signup-name", email: "signup-email", password: "signup-password", terms: "signup-terms" };

function SignUpForm({ role, next }: SignUpFormProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  function fail(form: HTMLFormElement, found: Errors) {
    setErrors(found);
    const first = (["name", "email", "password", "terms"] as const).find((field) => found[field]);
    if (first) form.querySelector<HTMLInputElement>(`#${FIELD_IDS[first]}`)?.focus();
  }

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const email = normalizeEmail(String(data.get("email") ?? ""));
    const password = String(data.get("password") ?? "");
    const accepted = data.get("terms") === "on";

    const found: Errors = {};
    if (!name) found.name = "Masukkan nama lengkapmu.";
    if (!isValidEmail(email)) found.email = "Masukkan email yang valid.";
    if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
      found.password = `Password harus ${MIN_PASSWORD_LENGTH} sampai ${MAX_PASSWORD_LENGTH} karakter.`;
    }
    if (!accepted) found.terms = "Setujui Syarat Layanan dan Kebijakan Privasi untuk mendaftar.";
    if (Object.keys(found).length > 0) {
      fail(form, found);
      return;
    }

    setErrors({});
    setPending(true);
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
      router.push(checkEmailPath(role, next, email));
      return;
    }

    setPending(false);
    const failure = classifySignUpError(error);
    if (failure.kind === "field") fail(form, { [failure.field]: failure.message });
    else setErrors({ form: failure.message });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FieldGroup>
        {errors.form ? <AuthAlert>{errors.form}</AuthAlert> : null}
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor={FIELD_IDS.name}>Nama lengkap</FieldLabel>
          <Input
            id={FIELD_IDS.name}
            name="name"
            autoComplete="name"
            required
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "signup-name-error" : undefined}
            className="h-10"
          />
          {errors.name ? <FieldError id="signup-name-error">{errors.name}</FieldError> : null}
        </Field>
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor={FIELD_IDS.email}>Email</FieldLabel>
          <Input
            id={FIELD_IDS.email}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "signup-email-error" : undefined}
            className="h-10"
          />
          {errors.email ? <FieldError id="signup-email-error">{errors.email}</FieldError> : null}
        </Field>
        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor={FIELD_IDS.password}>Password</FieldLabel>
          <Input
            id={FIELD_IDS.password}
            name="password"
            type="password"
            autoComplete="new-password"
            required
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "signup-password-error" : "signup-password-hint"}
            className="h-10"
          />
          <FieldDescription id="signup-password-hint">Minimal {MIN_PASSWORD_LENGTH} karakter.</FieldDescription>
          {errors.password ? <FieldError id="signup-password-error">{errors.password}</FieldError> : null}
        </Field>
        <Field data-invalid={!!errors.terms}>
          <div className="flex items-start gap-2.5">
            <input
              id={FIELD_IDS.terms}
              name="terms"
              type="checkbox"
              aria-invalid={!!errors.terms}
              aria-describedby={errors.terms ? "signup-terms-error" : undefined}
              className="mt-0.5 size-4 shrink-0 accent-primary"
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
          {errors.terms ? <FieldError id="signup-terms-error">{errors.terms}</FieldError> : null}
        </Field>
        <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
          {pending ? "Memproses..." : "Daftar"}
        </Button>
      </FieldGroup>
    </form>
  );
}

export { SignUpForm };
