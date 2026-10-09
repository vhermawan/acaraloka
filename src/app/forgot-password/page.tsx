import type { Metadata } from "next";
import Link from "next/link";

import { AuthFrame } from "@/components/auth/auth-frame";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { loginPathFor, parseIntent } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Lupa password",
  robots: { index: false },
};

export default async function ForgotPasswordPage({ searchParams }: PageProps<"/forgot-password">) {
  const { intent } = await searchParams;
  const role = parseIntent(intent);

  return (
    <AuthFrame
      heading="Lupa password"
      description="Masukkan email akunmu. Kami kirim tautan untuk memilih password baru."
      footer={
        <p>
          Ingat passwordmu?{" "}
          <Link href={loginPathFor(role)} className="font-medium text-primary underline-offset-4 hover:underline">
            Masuk
          </Link>
        </p>
      }
    >
      <ForgotPasswordForm role={role} />
    </AuthFrame>
  );
}
