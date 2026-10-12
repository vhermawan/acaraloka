"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";

import type { AiAllowlistState } from "@/actions/admin-ai";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type AiAllowlistFormProps = {
  action: (state: AiAllowlistState, formData: FormData) => Promise<AiAllowlistState>;
};

function AiAllowlistForm({ action }: AiAllowlistFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.done) return;
    formRef.current?.reset();
    toast.success("Akun ditambahkan ke daftar akses AI.");
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <Field className="sm:w-80" data-invalid={!!state.error}>
        <FieldLabel htmlFor="ai-allowlist-email">Email panitia</FieldLabel>
        <Input
          id="ai-allowlist-email"
          name="email"
          type="email"
          autoComplete="off"
          placeholder="panitia@contoh.id"
          defaultValue={state.values?.email}
          aria-invalid={!!state.error}
          required
        />
        <FieldError errors={state.error ? [{ message: state.error }] : undefined} />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Menambahkan..." : "Tambahkan"}
      </Button>
    </form>
  );
}

export { AiAllowlistForm };
