"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteEvent } from "@/app/organizer/events/actions";
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

type DeleteEventButtonProps = {
  eventId: string;
  title: string;
};

function DeleteEventButton({ eventId, title }: DeleteEventButtonProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteEvent(eventId);
      if (result?.error) {
        toast.error(result.error);
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" className="h-10 border-destructive/40 px-4 text-destructive hover:bg-destructive/5 hover:text-destructive" />}>Hapus draf</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hapus &ldquo;{title}&rdquo;?</DialogTitle>
          <DialogDescription>Draf, tiket, dan formulir acara ini akan dihapus permanen.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Batal</DialogClose>
          <Button variant="destructive" onClick={handleDelete} disabled={pending}>
            {pending ? "Menghapus..." : "Hapus"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { DeleteEventButton };
