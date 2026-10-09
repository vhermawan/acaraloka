"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { cancelParticipant } from "@/app/organizer/events/[id]/participants/actions";
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
import { cancellationReasonSchema } from "@/lib/validation/cancellation";

type CancelParticipantButtonProps = {
  eventId: string;
  registrationId: string;
  name: string;
};

const cancelParticipantSchema = z.object({ reason: cancellationReasonSchema });

function CancelParticipantButton({ eventId, registrationId, name }: CancelParticipantButtonProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const reasonId = `cancel-reason-${registrationId}`;
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.input<typeof cancelParticipantSchema>, unknown, z.output<typeof cancelParticipantSchema>>({
    resolver: zodResolver(cancelParticipantSchema),
    defaultValues: { reason: "" },
    mode: "onTouched",
  });

  const onSubmit = handleSubmit(({ reason }) => {
    startTransition(async () => {
      const result = await cancelParticipant(eventId, registrationId, reason);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Pendaftaran ${name} dibatalkan.`);
      setOpen(false);
      reset();
    });
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" className="h-11 px-3 text-destructive hover:bg-destructive/5 hover:text-destructive md:h-9" />}
      >
        Batalkan
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Batalkan pendaftaran {name}?</DialogTitle>
            <DialogDescription>Tiket peserta tidak berlaku lagi dan kuotanya dilepas.</DialogDescription>
          </DialogHeader>
          <Field data-invalid={!!errors.reason}>
            <FieldLabel htmlFor={reasonId}>Alasan (opsional)</FieldLabel>
            <Textarea
              id={reasonId}
              rows={3}
              placeholder="Contoh: Peserta minta dibatalkan lewat email."
              aria-invalid={!!errors.reason}
              {...register("reason")}
            />
            <FieldError errors={[errors.reason]} />
          </Field>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>Tidak jadi</DialogClose>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Membatalkan..." : "Batalkan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { CancelParticipantButton };
