import { Badge } from "@/components/ui/badge";
import { EMAIL_STATUS_LABELS, type EmailStatusFilter } from "@/lib/admin-email";

const STYLES: Record<EmailStatusFilter, string> = {
  PENDING: "text-muted-foreground",
  SENDING: "border-transparent bg-secondary text-secondary-foreground",
  SENT: "border-transparent bg-success/10 text-success",
  FAILED: "border-transparent bg-destructive/10 text-destructive",
};

function EmailStatusBadge({ status }: { status: EmailStatusFilter }) {
  return (
    <Badge variant="outline" className={STYLES[status]}>
      {EMAIL_STATUS_LABELS[status]}
    </Badge>
  );
}

export { EmailStatusBadge };
