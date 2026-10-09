import Link from "next/link";

import { Container } from "@/components/layout/container";
import { CREATE_EVENT_HREF } from "@/components/layout/create-event-href";

function ClosingCta() {
  return (
    <section aria-labelledby="cta-heading" className="bg-primary py-18 text-primary-foreground lg:py-24">
      <Container className="flex flex-col items-center gap-6 text-center">
        <h2 id="cta-heading" className="text-[28px]/9 font-bold tracking-[-0.8px] text-balance sm:text-5xl/14">
          Acara berikutnya, tanpa absen kertas
        </h2>
        <p className="text-[17px]/7 text-pretty text-primary-foreground/90">
          Buat acara pertama kamu hari ini. Gratis, dan peserta cuma butuh HP.
        </p>
        <Link
          href={CREATE_EVENT_HREF}
          className="inline-flex h-11 items-center rounded-lg bg-background px-5 text-[15px] font-medium text-primary transition-colors hover:bg-background/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-foreground"
        >
          Buat acara gratis
        </Link>
      </Container>
    </section>
  );
}

export { ClosingCta };
