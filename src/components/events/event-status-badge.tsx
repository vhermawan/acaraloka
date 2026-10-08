import { Badge } from "@/components/ui/badge";

const LABELS = {
  DRAFT: { label: "Draf", className: "border-border text-muted-foreground" },
  PUBLISHED: { label: "Terbit", className: "bg-success/10 text-success" },
  CANCELLED: { label: "Dibatalkan", className: "bg-destructive/10 text-destructive" },
  DISABLED: { label: "Dinonaktifkan", className: "bg-destructive/10 text-destructive" },
} as const;

function EventStatusBadge({ status }: { status: keyof typeof LABELS }) {
  const { label, className } = LABELS[status];
  return (
    <Badge variant="outline" className={status === "DRAFT" ? className : `border-transparent ${className}`}>
      {label}
    </Badge>
  );
}

export { EventStatusBadge };
