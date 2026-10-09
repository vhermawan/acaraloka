"use client";

import { useActionState, useState } from "react";

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
  const inputId = `disable-user-reason-${userId}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" size="sm" />}>Nonaktifkan</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={formAction} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Nonaktifkan pengguna?</DialogTitle>
            <DialogDescription>
              {name} langsung keluar dari semua perangkat dan tidak bisa masuk lagi sampai diaktifkan kembali. Data
              pendaftaran dan sertifikatnya tetap tersimpan.
            </DialogDescription>
          </DialogHeader>
          <Field data-invalid={!!state.error}>
            <FieldLabel htmlFor={inputId}>Alasan penonaktifan</FieldLabel>
            <Textarea
              id={inputId}
              name="reason"
              rows={3}
              defaultValue={state.values?.reason}
              aria-invalid={!!state.error}
            />
            <FieldError errors={state.error ? [{ message: state.error }] : undefined} />
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
