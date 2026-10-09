"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type DrainQueueButtonProps = {
  action: () => Promise<{ error?: string; message?: string }>;
  disabled?: boolean;
};

function DrainQueueButton({ action, disabled = false }: DrainQueueButtonProps) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      disabled={disabled || pending}
      onClick={() =>
        startTransition(async () => {
          const result = await action();
          if (result.error) toast.error(result.error);
          else toast.success(result.message ?? "Antrean diproses.");
        })
      }
    >
      {pending ? "Memproses..." : "Proses antrean sekarang"}
    </Button>
  );
}

export { DrainQueueButton };
