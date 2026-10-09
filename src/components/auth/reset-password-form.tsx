"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthAlert } from "@/components/auth/auth-alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/lib/auth-config";
import { classifyResetError } from "@/lib/auth-errors";
import { loginPathFor, type UserRole } from "@/lib/roles";

type ResetPasswordFormProps = {
  token: string;
  role: UserRole;
};

function ResetPasswordForm({ token, role }: ResetPasswordFormProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const password = String(new FormData(form).get("password") ?? "");
    const lengthMessage = `Password harus ${MIN_PASSWORD_LENGTH} sampai ${MAX_PASSWORD_LENGTH} karakter.`;
    if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
      setPasswordError(lengthMessage);
      form.querySelector<HTMLInputElement>("#reset-password")?.focus();
      return;
    }

    setPasswordError(null);
    setFormError(null);
    setPending(true);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    if (!error) {
      router.push(`${loginPathFor(role)}?notice=reset`);
      return;
    }

    setPending(false);
    const failure = classifyResetError(error);
    if (failure.kind === "field") setPasswordError(failure.message);
    else setFormError(failure.message);
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FieldGroup>
        {formError ? <AuthAlert>{formError}</AuthAlert> : null}
        <Field data-invalid={!!passwordError}>
          <FieldLabel htmlFor="reset-password">Password baru</FieldLabel>
          <Input
            id="reset-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            aria-invalid={!!passwordError}
            aria-describedby={passwordError ? "reset-password-error" : "reset-password-hint"}
            className="h-10"
          />
          <FieldDescription id="reset-password-hint">Minimal {MIN_PASSWORD_LENGTH} karakter.</FieldDescription>
          {passwordError ? <FieldError id="reset-password-error">{passwordError}</FieldError> : null}
        </Field>
        <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
          {pending ? "Menyimpan..." : "Simpan password baru"}
        </Button>
      </FieldGroup>
    </form>
  );
}

export { ResetPasswordForm };
