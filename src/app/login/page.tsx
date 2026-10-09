import type { Metadata } from "next";
import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { InAppBrowserNotice } from "@/components/auth/in-app-browser-notice";
import { LoginShowcase } from "@/components/auth/login-showcase";
import { env } from "@/lib/env";
import {
  buildChromeIntentUrl,
  detectInAppBrowser,
  isAndroid,
  type InAppBrowser,
} from "@/lib/in-app-browser";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { getSession } from "@/lib/session";
import { APP_NAME } from "@/lib/brand";
import { LEGAL_OPERATOR } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Masuk",
};

const APP_NAMES: Record<InAppBrowser, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  line: "LINE",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  const nextPath = safeRedirectPath(next);

  const session = await getSession();
  if (session && !session.user.disabledAt) redirect(nextPath);

  const userAgent = (await headers()).get("user-agent");
  const inApp = detectInAppBrowser(userAgent);
  const loginUrl = new URL("/login", env.APP_BASE_URL);
  if (nextPath !== "/") loginUrl.searchParams.set("next", nextPath);
  const callbackURL = `/legal/accept?next=${encodeURIComponent(nextPath)}`;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-sidebar p-4 sm:p-8">
      <div className="grid w-full max-w-5xl gap-3 rounded-2xl border border-border bg-card p-3 md:min-h-144 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <LoginShowcase />
        <section
          aria-labelledby="login-heading"
          className="flex flex-col items-center justify-center px-3 py-10 sm:px-8"
        >
          <div className="flex w-full max-w-sm flex-col gap-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <Link
                href="/"
                className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Image src="/logo/acaraloka-simbol.svg" alt={APP_NAME} width={24} height={29} className="h-7 w-auto" />
              </Link>
              <h1 id="login-heading" className="text-2xl/8 font-semibold tracking-tight">
                {inApp ? "Buka di browser" : `Masuk ke ${APP_NAME}`}
              </h1>
              <p className="text-sm text-muted-foreground">
                {inApp
                  ? "Halaman ini dibuka dari dalam aplikasi lain."
                  : "Daftar acara, simpan e-tiket, dan kelola acaramu sebagai panitia."}
              </p>
            </div>

            {inApp ? (
              <InAppBrowserNotice
                url={loginUrl.toString()}
                intentUrl={isAndroid(userAgent) ? buildChromeIntentUrl(loginUrl.toString()) : null}
                appName={APP_NAMES[inApp]}
              />
            ) : (
              <div className="flex flex-col gap-4">
                {error === "disabled" ? (
                  <p
                    role="alert"
                    className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                  >
                    Akun ini dinonaktifkan. Hubungi admin {APP_NAME} di {LEGAL_OPERATOR.email}{" "}
                    jika menurutmu ini keliru.
                  </p>
                ) : null}
                <GoogleSignInButton callbackURL={callbackURL} />
                <p className="text-center text-xs/5 text-muted-foreground">
                  Dari akun Google kami memakai nama, email, dan foto profil. Baca{" "}
                  <Link href="/legal/privacy" className="font-medium text-primary underline-offset-4 hover:underline">
                    Kebijakan Privasi
                  </Link>{" "}
                  dan{" "}
                  <Link href="/legal/terms" className="font-medium text-primary underline-offset-4 hover:underline">
                    Syarat Layanan
                  </Link>
                  .
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
