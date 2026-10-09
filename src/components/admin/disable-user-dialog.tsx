"use client";

import { useActionState, useEffect, useMemo, useState } from "react";

import type { DisableUserState } from "@/app/admin/users/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useActionForm } from "@/hooks/use-action-form";
import { disableReasonFormSchema } from "@/lib/validation/event-disable";

type DisableUserDialogProps = {
  userId: string;
  name: string;
  action: (state: DisableUserState, formData: FormData) => Promise<DisableUserState>;
};

function DisableUserDialog({ userId, name, action }: DisableUserDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prev: DisableUserState, formData: FormData) => {
      const next = await action(prev, formData);
      if (next.done) setOpen(false);
      return next;
    },
    {},
  );
  const serverErrors = useMemo(() => ({ reason: state.error ? [state.error] : undefined }), [state.error]);
  const {
    form: {
      register,
      reset,
      formState: { errors },
    },
    onSubmit,
  } = useActionForm(disableReasonFormSchema, {
    defaultValues: { reason: "" },
    dispatch: formAction,
    serverErrors,
  });

  useEffect(() => {
    if (state.done) reset();
  }, [state, reset]);
  const inputId = `disable-user-reason-${userId}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" size="sm" />}>Nonaktifkan</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Nonaktifkan pengguna?</DialogTitle>
            <DialogDescription>
              {name} langsung keluar dari semua perangkat dan tidak bisa masuk lagi sampai diaktifkan kembali. Data
              pendaftaran dan sertifikatnya tetap tersimpan.
            </DialogDescription>
          </DialogHeader>
          <Field data-invalid={!!errors.reason}>
            <FieldLabel htmlFor={inputId}>Alasan penonaktifan</FieldLabel>
            <Textarea
              id={inputId}
              rows={3}
              placeholder="Contoh: Akun dipakai untuk mengirim spam ke peserta."
              aria-invalid={!!errors.reason}
              {...register("reason")}
            />
            <FieldError errors={[errors.reason]} />
          </Field>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Tidak jadi</DialogClose>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Menonaktifkan..." : "Nonaktifkan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { DisableUserDialog };
