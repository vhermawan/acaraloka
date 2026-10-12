"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

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

type RemoveAiAllowlistDialogProps = {
  name: string;
  action: () => Promise<{ error?: string }>;
};

function RemoveAiAllowlistDialog({ name, action }: RemoveAiAllowlistDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" size="sm" />}>Hapus</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Hapus akses AI?</DialogTitle>
          <DialogDescription>
            {name} tidak bisa lagi membuat desain AI. Desain yang sudah dipakai di sertifikat tetap utuh.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>Tidak jadi</DialogClose>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await action();
                if (result.error) {
                  toast.error(result.error);
                  return;
                }
                toast.success("Akses AI dihapus.");
                setOpen(false);
              })
            }
          >
            {pending ? "Menghapus..." : "Hapus akses"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { RemoveAiAllowlistDialog };
