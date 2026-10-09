"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { RESEND_COOLDOWN_SECONDS } from "@/lib/auth-config";
import { AUTH_FALLBACK_ERROR, AUTH_RATE_LIMIT_ERROR } from "@/lib/auth-errors";
import { continuePath, type UserRole } from "@/lib/roles";

type ResendVerificationProps = {
  email: string;
  role: UserRole;
  next: string;
};

type Feedback = { tone: "success" | "error"; text: string };

function ResendVerification({ email, role, next }: ResendVerificationProps) {
  const [remaining, setRemaining] = useState(RESEND_COOLDOWN_SECONDS);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setTimeout(() => setRemaining((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining]);

  async function handleResend() {
    setPending(true);
    setFeedback(null);
    const { error } = await authClient.sendVerificationEmail({ email, callbackURL: continuePath(role, next) });
    setPending(false);
    setRemaining(RESEND_COOLDOWN_SECONDS);
    if (!error) {
      setFeedback({ tone: "success", text: "Email verifikasi dikirim ulang. Cek inbox dan folder spam." });
      return;
    }
    setFeedback({ tone: "error", text: error.status === 429 ? AUTH_RATE_LIMIT_ERROR : AUTH_FALLBACK_ERROR });
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="h-11 w-full"
        onClick={handleResend}
        disabled={pending || remaining > 0}
      >
        {pending ? "Mengirim..." : remaining > 0 ? `Kirim ulang dalam ${remaining} detik` : "Kirim ulang email"}
      </Button>
      <p
        role={feedback?.tone === "error" ? "alert" : "status"}
        className={feedback?.tone === "error" ? "text-center text-sm text-destructive" : "text-center text-sm text-muted-foreground"}
      >
        {feedback?.text}
      </p>
    </div>
  );
}

export { ResendVerification };
