import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { InAppBrowserNotice } from "@/components/auth/in-app-browser-notice";
import { Container } from "@/components/layout/container";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <Container className="flex justify-center py-12">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            {inApp ? "Buka di browser" : "Masuk"}
          </CardTitle>
          <CardDescription>
            {inApp
              ? "Halaman ini dibuka dari dalam aplikasi lain."
              : "Gunakan akun Google untuk mendaftar acara dan mengelola tiket."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {inApp ? (
            <InAppBrowserNotice
              url={loginUrl.toString()}
              intentUrl={isAndroid(userAgent) ? buildChromeIntentUrl(loginUrl.toString()) : null}
              appName={APP_NAMES[inApp]}
            />
          ) : (
            <div className="flex flex-col gap-3">
              {error === "disabled" ? (
                <p role="alert" className="text-sm text-destructive">
                  Akun ini dinonaktifkan. Hubungi admin {APP_NAME} di {LEGAL_OPERATOR.email}{" "}
                  jika menurutmu ini keliru.
                </p>
              ) : null}
              <GoogleSignInButton callbackURL={callbackURL} />
            </div>
          )}
        </CardContent>
      </Card>
    </Container>
  );
}
