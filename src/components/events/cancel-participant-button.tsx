"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

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
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

type CancelParticipantButtonProps = {
  eventId: string;
  registrationId: string;
  name: string;
};

function CancelParticipantButton({ eventId, registrationId, name }: CancelParticipantButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const reasonId = `cancel-reason-${registrationId}`;

  function handleConfirm() {
    startTransition(async () => {
      const result = await cancelParticipant(eventId, registrationId, reason);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Pendaftaran ${name} dibatalkan.`);
      setOpen(false);
      setReason("");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" className="h-11 px-3 text-destructive hover:bg-destructive/5 hover:text-destructive md:h-9" />}
      >
        Batalkan
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Batalkan pendaftaran {name}?</DialogTitle>
          <DialogDescription>Tiket peserta tidak berlaku lagi dan kuotanya dilepas.</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor={reasonId}>Alasan (opsional)</FieldLabel>
          <Textarea id={reasonId} value={reason} onChange={(event) => setReason(event.target.value)} rows={3} />
        </Field>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Tidak jadi</DialogClose>
          <Button variant="destructive" onClick={handleConfirm} disabled={pending}>
            {pending ? "Membatalkan..." : "Batalkan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { CancelParticipantButton };
