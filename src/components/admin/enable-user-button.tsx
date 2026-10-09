"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type EnableUserButtonProps = {
  action: () => Promise<{ error?: string }>;
};

function EnableUserButton({ action }: EnableUserButtonProps) {
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
          else toast.success("Pengguna diaktifkan kembali.");
        })
      }
    >
      {pending ? "Mengaktifkan..." : "Aktifkan kembali"}
    </Button>
  );
}

export { EnableUserButton };
