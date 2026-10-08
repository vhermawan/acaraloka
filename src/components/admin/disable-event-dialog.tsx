"use client";

import { useActionState, useState } from "react";

import type { DisableEventState } from "@/app/admin/events/actions";
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

type DisableEventDialogProps = {
  eventId: string;
  title: string;
  action: (state: DisableEventState, formData: FormData) => Promise<DisableEventState>;
};

function DisableEventDialog({ eventId, title, action }: DisableEventDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prev: DisableEventState, formData: FormData) => {
      const next = await action(prev, formData);
      if (next.done) setOpen(false);
      return next;
    },
    {},
  );
  const inputId = `disable-reason-${eventId}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" size="sm" />}>Nonaktifkan</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={formAction} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Nonaktifkan acara?</DialogTitle>
            <DialogDescription>
              {title} tidak bisa dibuka publik, didaftari, atau dipakai check-in dan penerbitan sertifikat. Sertifikat
              yang sudah terbit tetap berlaku. Panitia melihat alasan di dashboard acara.
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

export { DisableEventDialog };
