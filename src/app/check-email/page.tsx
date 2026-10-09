import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthFrame } from "@/components/auth/auth-frame";
import { ResendVerification } from "@/components/auth/resend-verification";
import { isValidEmail, normalizeEmail } from "@/lib/auth-errors";
import { loginPathFor, parseIntent, pathWithNext, resolvePostLoginPath } from "@/lib/roles";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Cek email",
  robots: { index: false },
};

export default async function CheckEmailPage({ searchParams }: PageProps<"/check-email">) {
  const { email, intent, next } = await searchParams;
  const role = parseIntent(intent);
  const address = typeof email === "string" ? normalizeEmail(email) : "";
  if (!isValidEmail(address)) redirect(loginPathFor(role));
  const nextPath = resolvePostLoginPath(role, next, true);

  return (
    <AuthFrame
      heading="Cek email kamu"
      description="Satu langkah lagi untuk mengaktifkan akunmu."
      footer={
        <p>
          Sudah verifikasi?{" "}
          <Link
            href={pathWithNext(loginPathFor(role), role, nextPath)}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Masuk
          </Link>
        </p>
      }
    >
      <div className="flex flex-col gap-5">
        <p className="text-center text-sm/6">
          Kami mengirim tautan verifikasi ke <span className="font-medium break-all">{address}</span>. Klik tautan itu
          untuk melanjutkan. Belum masuk? Cek juga folder spam.
        </p>
        <ResendVerification email={address} role={role} next={nextPath} />
      </div>
    </AuthFrame>
  );
}
