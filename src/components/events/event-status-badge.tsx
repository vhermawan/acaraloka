import { Badge } from "@/components/ui/badge";

const LABELS = {
  DRAFT: { label: "Draf", variant: "outline" },
  PUBLISHED: { label: "Terbit", variant: "default" },
  CANCELLED: { label: "Dibatalkan", variant: "destructive" },
  DISABLED: { label: "Dinonaktifkan", variant: "destructive" },
} as const;

function EventStatusBadge({ status }: { status: keyof typeof LABELS }) {
  const { label, variant } = LABELS[status];
  return <Badge variant={variant}>{label}</Badge>;
}

export { EventStatusBadge };
