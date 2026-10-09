"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useEffect } from "react";
import { useForm, type DefaultValues, type FieldValues, type Path } from "react-hook-form";
import type { z } from "zod";

type ServerErrors = Partial<Record<string, string[] | undefined>>;

type UseActionFormOptions<TInput extends FieldValues> = {
  defaultValues: DefaultValues<TInput>;
  dispatch: (formData: FormData) => void;
  serverErrors?: ServerErrors;
};

function useActionForm<TInput extends FieldValues, TOutput>(
  schema: z.ZodType<TOutput, TInput>,
  { defaultValues, dispatch, serverErrors }: UseActionFormOptions<TInput>,
) {
  const form = useForm<TInput, unknown, TOutput>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onTouched",
  });
  const { setError } = form;

  useEffect(() => {
    if (!serverErrors) return;
    const entries = Object.entries(serverErrors).filter(([, messages]) => messages?.length);
    entries.forEach(([name, messages], index) => {
      setError(name as Path<TInput>, { type: "server", message: messages?.[0] }, { shouldFocus: index === 0 });
    });
  }, [serverErrors, setError]);

  const onSubmit = form.handleSubmit((_values, event) => {
    if (!(event?.target instanceof HTMLFormElement)) return;
    const formData = new FormData(event.target);
    startTransition(() => dispatch(formData));
  });

  return { form, onSubmit };
}

export { useActionForm };
