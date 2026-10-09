import { Badge } from "@/components/ui/badge";

function UserStatusBadge({ disabled }: { disabled: boolean }) {
  return disabled ? (
    <Badge variant="outline" className="border-transparent bg-destructive/10 text-destructive">
      Dinonaktifkan
    </Badge>
  ) : (
    <Badge variant="outline" className="border-transparent bg-success/10 text-success">
      Aktif
    </Badge>
  );
}

export { UserStatusBadge };
