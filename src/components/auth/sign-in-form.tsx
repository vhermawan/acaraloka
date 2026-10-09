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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { classifySignInError } from "@/lib/auth-errors";
import { checkEmailPath, continuePath, forgotPasswordPath, type UserRole } from "@/lib/roles";
import { signInSchema } from "@/lib/validation/auth";

type SignInFormProps = {
  role: UserRole;
  next: string;
};

function SignInForm({ role, next }: SignInFormProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof signInSchema>, unknown, z.output<typeof signInSchema>>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
    mode: "onTouched",
  });
  const pending = isSubmitting || leaving;

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null);
    const destination = continuePath(role, next);
    const { error } = await authClient.signIn.email({ email, password, callbackURL: destination });
    if (!error) {
      setLeaving(true);
      window.location.assign(destination);
      return;
    }

    const failure = classifySignInError(error);
    if (failure.kind === "unverified") {
      setLeaving(true);
      router.push(checkEmailPath(role, next, email));
      return;
    }
    setFormError(failure.message);
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        {formError ? <AuthAlert>{formError}</AuthAlert> : null}
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="signin-email">Email</FieldLabel>
          <Input
            id="signin-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="nama@email.com"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "signin-email-error" : undefined}
            className="h-10"
            {...register("email")}
          />
          <FieldError id="signin-email-error" errors={[errors.email]} />
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
            autoComplete="current-password"
            placeholder="Masukkan password"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "signin-password-error" : undefined}
            className="h-10"
            {...register("password")}
          />
          <FieldError id="signin-password-error" errors={[errors.password]} />
        </Field>
        <Button type="submit" size="lg" className="h-11 w-full" disabled={pending}>
          {pending ? "Memproses..." : "Masuk"}
        </Button>
      </FieldGroup>
    </form>
  );
}

export { SignInForm };
