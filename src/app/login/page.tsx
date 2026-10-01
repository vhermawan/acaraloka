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
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Masuk | event-in",
};

const APP_NAMES: Record<InAppBrowser, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  line: "LINE",
};

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/");

  const userAgent = (await headers()).get("user-agent");
  const inApp = detectInAppBrowser(userAgent);
  const loginUrl = new URL("/login", env.APP_BASE_URL).toString();

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
              url={loginUrl}
              intentUrl={isAndroid(userAgent) ? buildChromeIntentUrl(loginUrl) : null}
              appName={APP_NAMES[inApp]}
            />
          ) : (
            <GoogleSignInButton />
          )}
        </CardContent>
      </Card>
    </Container>
  );
}
