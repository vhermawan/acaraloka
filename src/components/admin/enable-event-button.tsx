"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type EnableEventButtonProps = {
  action: () => Promise<{ error?: string }>;
};

function EnableEventButton({ action }: EnableEventButtonProps) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await action();
          if (result.error) toast.error(result.error);
          else toast.success("Acara diaktifkan kembali.");
        })
      }
    >
      {pending ? "Mengaktifkan..." : "Aktifkan kembali"}
    </Button>
  );
}

export { EnableEventButton };
