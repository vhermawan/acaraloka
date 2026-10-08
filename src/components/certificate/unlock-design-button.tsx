"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { unlockDesign } from "@/app/organizer/events/[id]/certificate/actions";
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

function UnlockDesignButton({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await unlockDesign(eventId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Desain dibuka. Semua tanda tangan direset.");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" className="h-10 w-fit px-4" />}>Buka kunci desain</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Buka kunci desain?</DialogTitle>
          <DialogDescription>
            Semua tanda tangan yang sudah masuk dihapus dan tautan lama tidak berlaku. Setelah mengubah desain, buat ulang
            tautan dan minta semua penandatangan tanda tangan lagi.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Tidak jadi</DialogClose>
          <Button variant="destructive" onClick={confirm} disabled={pending}>
            {pending ? "Membuka..." : "Buka kunci dan reset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { UnlockDesignButton };
