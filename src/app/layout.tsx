import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";

import { CloudflareAnalytics } from "@/components/analytics/cloudflare-analytics";
import { FlashToast } from "@/components/layout/flash-toast";
import { SiteChrome } from "@/components/layout/site-chrome";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Toaster } from "@/components/ui/sonner";
import { env } from "@/lib/env";
import { APP_NAME } from "@/lib/brand";

const fontSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const fontMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(env.APP_BASE_URL),
  title: { default: APP_NAME, template: `%s | ${APP_NAME}` },
  description:
    `${APP_NAME} membantu panitia mengelola pendaftaran, e-tiket QR, check-in, dan sertifikat bertanda tangan untuk seminar, workshop, dan meetup.`,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${fontSans.variable} ${fontMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <SiteChrome>
          <SiteHeader />
        </SiteChrome>
        <main className="flex-1">{children}</main>
        <SiteChrome>
          <SiteFooter />
        </SiteChrome>
        <Toaster />
        <FlashToast />
        <CloudflareAnalytics />
      </body>
    </html>
  );
}
