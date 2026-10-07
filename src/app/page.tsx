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

export const metadata: Metadata = {
  title: "Hadirly | Pendaftaran, check-in, dan sertifikat acara",
  description:
    "Hadirly membantu panitia seminar, workshop, dan meetup mengurus pendaftaran, e-tiket QR, check-in, dan sertifikat bertanda tangan dalam satu tempat.",
};

export default function Home() {
  return (
    <>
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
