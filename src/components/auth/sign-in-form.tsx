"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthAlert } from "@/components/auth/auth-alert";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { classifySignInError, isValidEmail, normalizeEmail } from "@/lib/auth-errors";
import { checkEmailPath, continuePath, forgotPasswordPath, type UserRole } from "@/lib/roles";

type SignInFormProps = {
  role: UserRole;
  next: string;
};

type Errors = { email?: string; password?: string; form?: string };

function SignInForm({ role, next }: SignInFormProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = normalizeEmail(String(data.get("email") ?? ""));
    const password = String(data.get("password") ?? "");

    const found: Errors = {};
    if (!isValidEmail(email)) found.email = "Masukkan email yang valid.";
    if (!password) found.password = "Masukkan password.";
    if (found.email || found.password) {
      setErrors(found);
      form.querySelector<HTMLInputElement>(found.email ? "#signin-email" : "#signin-password")?.focus();
      return;
    }

    setErrors({});
    setPending(true);
    const destination = continuePath(role, next);
    const { error } = await authClient.signIn.email({ email, password, callbackURL: destination });
    if (!error) {
      window.location.assign(destination);
      return;
    }

    const failure = classifySignInError(error);
    if (failure.kind === "unverified") {
      router.push(checkEmailPath(role, next, email));
      return;
    }
    setPending(false);
    setErrors({ form: "message" in failure ? failure.message : undefined });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FieldGroup>
        {errors.form ? <AuthAlert>{errors.form}</AuthAlert> : null}
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="signin-email">Email</FieldLabel>
          <Input
            id="signin-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "signin-email-error" : undefined}
            className="h-10"
          />
          {errors.email ? <FieldError id="signin-email-error">{errors.email}</FieldError> : null}
        </Field>
        <Field data-invalid={!!errors.password}>
          <div className="flex items-center justify-between gap-2">
            <FieldLabel htmlFor="signin-password">Password</FieldLabel>
            <Link
              href={forgotPasswordPath(role)}
              className="rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Lupa password?
            </Link>
          </div>
          <PasswordInput
            id="signin-password"
            name="password"
            autoComplete="current-password"
            required
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "signin-password-error" : undefined}
            className="h-10"
          />
          {errors.password ? <FieldError id="signin-password-error">{errors.password}</FieldError> : null}
        </Field>
        <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
          {pending ? "Memproses..." : "Masuk"}
        </Button>
      </FieldGroup>
    </form>
  );
}

export { SignInForm };
