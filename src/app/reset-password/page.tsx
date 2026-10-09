import type { Metadata } from "next";
import Link from "next/link";

import { AuthAlert } from "@/components/auth/auth-alert";
import { AuthFrame } from "@/components/auth/auth-frame";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { buttonVariants } from "@/components/ui/button";
import { forgotPasswordPath, parseIntent } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Atur ulang password",
  robots: { index: false },
  referrer: "no-referrer",
};

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token, error, intent } = await searchParams;
  const role = parseIntent(intent);
  const validToken = typeof token === "string" && token.length > 0 && !error ? token : null;

  return (
    <AuthFrame
      heading="Atur ulang password"
      description={validToken ? "Pilih password baru untuk akunmu." : "Tautan ini tidak bisa dipakai."}
    >
      {validToken ? (
        <ResetPasswordForm token={validToken} role={role} />
      ) : (
        <div className="flex flex-col gap-4">
          <AuthAlert>Tautan atur ulang password tidak berlaku atau sudah kedaluwarsa.</AuthAlert>
          <Link href={forgotPasswordPath(role)} className={buttonVariants({ size: "lg", className: "h-11 w-full" })}>
            Minta tautan baru
          </Link>
        </div>
      )}
    </AuthFrame>
  );
}
