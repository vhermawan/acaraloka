"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

type GoogleSignInButtonProps = {
  callbackURL: string;
};

function GoogleSignInButton({ callbackURL }: GoogleSignInButtonProps) {
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL,
    });
    if (error) {
      setPending(false);
      toast.error("Gagal masuk dengan Google. Coba lagi.");
    }
  }

  return (
    <Button size="lg" onClick={handleClick} disabled={pending} className="w-full">
      {pending ? "Mengalihkan..." : "Masuk dengan Google"}
    </Button>
  );
}

export { GoogleSignInButton };
