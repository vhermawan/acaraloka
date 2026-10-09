"use client";

import { useActionState, useMemo } from "react";

import type { CancelEventState } from "@/app/organizer/events/actions";
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useActionForm } from "@/hooks/use-action-form";
import { cancelEventSchema } from "@/lib/validation/cancellation";

type CancelEventDialogProps = {
  title: string;
  action: (state: CancelEventState, formData: FormData) => Promise<CancelEventState>;
};

function CancelEventDialog({ title, action }: CancelEventDialogProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const schema = useMemo(() => cancelEventSchema(title), [title]);
  const {
    form: {
      register,
      formState: { errors },
    },
    onSubmit,
  } = useActionForm(schema, {
    defaultValues: { reason: "", confirmTitle: "" },
    dispatch: formAction,
    serverErrors: state.errors,
  });

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" className="h-10 border-destructive/40 px-4 text-destructive hover:bg-destructive/5 hover:text-destructive" />}>Batalkan acara</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Batalkan acara?</DialogTitle>
            <DialogDescription>
              Pendaftaran ditutup dan semua tiket tidak berlaku. Peserta melihat alasan di halaman acara dan Tiket
              Saya. Tindakan ini tidak bisa diurungkan.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            {state.message ? (
              <p role="alert" className="text-sm text-destructive">
                {state.message}
              </p>
            ) : null}
            <Field data-invalid={!!errors.reason}>
              <FieldLabel htmlFor="cancel-reason">Alasan pembatalan</FieldLabel>
              <Textarea
                id="cancel-reason"
                rows={3}
                placeholder="Contoh: Pembicara berhalangan dan acara belum bisa dijadwalkan ulang."
                aria-invalid={!!errors.reason}
                {...register("reason")}
              />
              <FieldError errors={[errors.reason]} />
            </Field>
            <Field data-invalid={!!errors.confirmTitle}>
              <FieldLabel htmlFor="cancel-confirm">
                Ketik <span className="font-semibold">{title}</span> untuk konfirmasi
              </FieldLabel>
              <Input
                id="cancel-confirm"
                autoComplete="off"
                placeholder={title}
                aria-invalid={!!errors.confirmTitle}
                {...register("confirmTitle")}
              />
              <FieldError errors={[errors.confirmTitle]} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Tidak jadi</DialogClose>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Membatalkan..." : "Batalkan acara"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { CancelEventDialog };
