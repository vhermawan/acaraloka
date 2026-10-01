"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { cancelMyRegistration } from "@/app/me/tickets/[id]/actions";
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

function CancelRegistrationButton({ registrationId }: { registrationId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await cancelMyRegistration(registrationId);
      if (result.error) toast.error(result.error);
      else toast.success("Pendaftaran dibatalkan.");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" className="w-fit" />}>Batalkan pendaftaran</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Batalkan pendaftaran?</DialogTitle>
          <DialogDescription>
            Tiketmu tidak berlaku lagi dan kuotanya dilepas untuk orang lain. Kamu bisa mendaftar lagi selama kuota
            masih ada.
          </DialogDescription>
        </DialogHeader>
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

export { CancelRegistrationButton };
