import { Lock } from "lucide-react";

function ReadOnlyNotice({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">
      <Lock className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
      {children}
    </p>
  );
}

export { ReadOnlyNotice };
