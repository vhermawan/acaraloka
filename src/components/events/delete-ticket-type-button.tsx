"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { deleteTicketType } from "@/app/organizer/events/[id]/tickets/actions";
import { Button } from "@/components/ui/button";

type DeleteTicketTypeButtonProps = {
  eventId: string;
  ticketTypeId: string;
  disabled?: boolean;
};

function DeleteTicketTypeButton({ eventId, ticketTypeId, disabled }: DeleteTicketTypeButtonProps) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={disabled || pending}
      onClick={() =>
        startTransition(async () => {
          const result = await deleteTicketType(eventId, ticketTypeId);
          if (result.error) toast.error(result.error);
          else toast.success("Tiket dihapus.");
        })
      }
    >
      {pending ? "Menghapus..." : "Hapus"}
    </Button>
  );
}

export { DeleteTicketTypeButton };
