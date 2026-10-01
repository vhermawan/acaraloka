import { Badge } from "@/components/ui/badge";
import { TICKET_STATE_LABELS, type TicketState } from "@/lib/ticket-state";

const VARIANTS = {
  ACTIVE: "default",
  CHECKED_IN: "secondary",
  CANCELLED: "destructive",
  EVENT_CANCELLED: "destructive",
  ENDED: "outline",
} as const;

function TicketStateBadge({ state }: { state: TicketState }) {
  return <Badge variant={VARIANTS[state]}>{TICKET_STATE_LABELS[state]}</Badge>;
}

export { TicketStateBadge };
