"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { AuthAlert } from "@/components/auth/auth-alert";
import { PasswordInput } from "@/components/auth/password-input";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth-config";
import { classifyResetError } from "@/lib/auth-errors";
import { loginPathFor, type UserRole } from "@/lib/roles";
import { resetPasswordSchema } from "@/lib/validation/auth";

type ResetPasswordFormProps = {
  token: string;
  role: UserRole;
};

function ResetPasswordForm({ token, role }: ResetPasswordFormProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof resetPasswordSchema>, unknown, z.output<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "" },
    mode: "onTouched",
  });
  const pending = isSubmitting || leaving;

  const onSubmit = handleSubmit(async ({ password }) => {
    setFormError(null);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    if (!error) {
      setLeaving(true);
      router.push(`${loginPathFor(role)}?notice=reset`);
      return;
    }

    const failure = classifyResetError(error);
    if (failure.kind === "field") setError("password", { type: "server", message: failure.message }, { shouldFocus: true });
    else setFormError(failure.message);
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        {formError ? <AuthAlert>{formError}</AuthAlert> : null}
        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="reset-password">Password baru</FieldLabel>
          <PasswordInput
            id="reset-password"
            autoComplete="new-password"
            placeholder="Buat password baru"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "reset-password-error" : "reset-password-hint"}
            className="h-10"
            {...register("password")}
          />
          <FieldDescription id="reset-password-hint">Minimal {MIN_PASSWORD_LENGTH} karakter.</FieldDescription>
          <FieldError id="reset-password-error" errors={[errors.password]} />
        </Field>
        <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
          {pending ? "Menyimpan..." : "Simpan password baru"}
        </Button>
      </FieldGroup>
    </form>
  );
}

export { ResetPasswordForm };
