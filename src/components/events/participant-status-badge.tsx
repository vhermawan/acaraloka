import { Badge } from "@/components/ui/badge";
import { PARTICIPANT_STATUS_LABELS, type ParticipantStatus } from "@/lib/participants";

const STYLES: Record<ParticipantStatus, string> = {
  REGISTERED: "border-border text-foreground",
  ATTENDED: "border-transparent bg-success/10 text-success",
  CANCELLED: "border-transparent bg-destructive/10 text-destructive",
};

function ParticipantStatusBadge({ status }: { status: ParticipantStatus }) {
  return (
    <Badge variant="outline" className={STYLES[status]}>
      {PARTICIPANT_STATUS_LABELS[status]}
    </Badge>
  );
}

export { ParticipantStatusBadge };
