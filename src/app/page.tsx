import type { Metadata } from "next";

import { AiTemplate } from "@/components/home/ai-template";
import { CertificateSpotlight } from "@/components/home/certificate-spotlight";
import { ClosingCta } from "@/components/home/closing-cta";
import { Faq } from "@/components/home/faq";
import { Features } from "@/components/home/features";
import { Hero } from "@/components/home/hero";
import { HowItWorks } from "@/components/home/how-it-works";
import { Pricing } from "@/components/home/pricing";
import { Roles } from "@/components/home/roles";
import { env } from "@/lib/env";
import { APP_NAME } from "@/lib/brand";

const TITLE = `${APP_NAME} | Pendaftaran, check-in, dan sertifikat acara`;
const DESCRIPTION =
  `${APP_NAME} membantu panitia seminar, workshop, dan meetup mengurus pendaftaran, e-tiket QR, check-in, dan sertifikat bertanda tangan dalam satu tempat.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: APP_NAME,
    locale: "id_ID",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

function structuredData() {
  const url = env.APP_BASE_URL.replace(/\/$/, "");
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "@id": `${url}/#website`, url, name: APP_NAME, inLanguage: "id-ID" },
      {
        "@type": "SoftwareApplication",
        name: APP_NAME,
        url,
        description: DESCRIPTION,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        inLanguage: "id-ID",
        offers: { "@type": "Offer", price: "0", priceCurrency: "IDR", description: "Gratis untuk acara tanpa tiket berbayar" },
      },
    ],
  };
}

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData()).replace(/</g, "\\u003c") }}
      />
      <Hero />
      <HowItWorks />
      <Features />
      <CertificateSpotlight />
      <AiTemplate />
      <Roles />
      <Pricing />
      <Faq />
      <ClosingCta />
    </>
  );
}
