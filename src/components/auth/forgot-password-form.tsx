"use client";

import { useState } from "react";

import { AuthAlert } from "@/components/auth/auth-alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { AUTH_FALLBACK_ERROR, AUTH_RATE_LIMIT_ERROR, isValidEmail, normalizeEmail } from "@/lib/auth-errors";
import { intentParam, type UserRole } from "@/lib/roles";

function ForgotPasswordForm({ role }: { role: UserRole }) {
  const [pending, setPending] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const email = normalizeEmail(String(new FormData(form).get("email") ?? ""));
    if (!isValidEmail(email)) {
      setEmailError("Masukkan email yang valid.");
      form.querySelector<HTMLInputElement>("#forgot-email")?.focus();
      return;
    }

    setEmailError(null);
    setFormError(null);
    setPending(true);
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: `/reset-password?intent=${intentParam(role)}`,
    });
    setPending(false);
    if (error) {
      setFormError(error.status === 429 ? AUTH_RATE_LIMIT_ERROR : AUTH_FALLBACK_ERROR);
      return;
    }
    setSentTo(email);
  }

  if (sentTo) {
    return (
      <AuthAlert tone="success">
        Kalau {sentTo} terdaftar, kami sudah mengirim tautan untuk mengatur ulang password. Cek inbox dan folder spam.
      </AuthAlert>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FieldGroup>
        {formError ? <AuthAlert>{formError}</AuthAlert> : null}
        <Field data-invalid={!!emailError}>
          <FieldLabel htmlFor="forgot-email">Email</FieldLabel>
          <Input
            id="forgot-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            aria-invalid={!!emailError}
            aria-describedby={emailError ? "forgot-email-error" : undefined}
            className="h-10"
          />
          {emailError ? <FieldError id="forgot-email-error">{emailError}</FieldError> : null}
        </Field>
        <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
          {pending ? "Mengirim..." : "Kirim tautan"}
        </Button>
      </FieldGroup>
    </form>
  );
}

export { ForgotPasswordForm };
