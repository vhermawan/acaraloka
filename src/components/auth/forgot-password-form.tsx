"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { AuthAlert } from "@/components/auth/auth-alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { AUTH_FALLBACK_ERROR, AUTH_RATE_LIMIT_ERROR } from "@/lib/auth-errors";
import { intentParam, type UserRole } from "@/lib/roles";
import { forgotPasswordSchema } from "@/lib/validation/auth";

function ForgotPasswordForm({ role }: { role: UserRole }) {
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof forgotPasswordSchema>, unknown, z.output<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
    mode: "onTouched",
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    setFormError(null);
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: `/reset-password?intent=${intentParam(role)}`,
    });
    if (error) {
      setFormError(error.status === 429 ? AUTH_RATE_LIMIT_ERROR : AUTH_FALLBACK_ERROR);
      return;
    }
    setSentTo(email);
  });

  if (sentTo) {
    return (
      <AuthAlert tone="success">
        Kalau {sentTo} terdaftar, kami sudah mengirim tautan untuk mengatur ulang password. Cek inbox dan folder spam.
      </AuthAlert>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        {formError ? <AuthAlert>{formError}</AuthAlert> : null}
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="forgot-email">Email</FieldLabel>
          <Input
            id="forgot-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="nama@email.com"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "forgot-email-error" : undefined}
            className="h-10"
            {...register("email")}
          />
          <FieldError id="forgot-email-error" errors={[errors.email]} />
        </Field>
        <Button type="submit" size="lg" className="h-11 w-full" disabled={isSubmitting}>
          {isSubmitting ? "Mengirim..." : "Kirim tautan"}
        </Button>
      </FieldGroup>
    </form>
  );
}

export { ForgotPasswordForm };
