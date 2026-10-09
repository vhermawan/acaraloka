import { cn } from "@/lib/utils";
import type { AuthNoticeTone } from "@/lib/auth-notice";

type AuthAlertProps = {
  tone?: AuthNoticeTone;
  id?: string;
  children: React.ReactNode;
};

function AuthAlert({ tone = "error", id, children }: AuthAlertProps) {
  return (
    <p
      id={id}
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg border px-3 py-2 text-sm",
        tone === "error"
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "border-primary/30 bg-primary/5 text-foreground",
      )}
    >
      {children}
    </p>
  );
}

export { AuthAlert };
