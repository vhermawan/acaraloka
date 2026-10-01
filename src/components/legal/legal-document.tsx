import type { ReactNode } from "react";

import { Container } from "@/components/layout/container";
import { TERMS_VERSION } from "@/lib/legal";

type LegalDocumentProps = {
  title: string;
  children: ReactNode;
};

function LegalDocument({ title, children }: LegalDocumentProps) {
  return (
    <Container className="py-12">
      <article className="mx-auto flex max-w-2xl flex-col gap-6 text-pretty text-sm leading-relaxed text-foreground [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1 [&_ul]:pl-5">
        <header className="flex flex-col gap-1">
          <h1 className="text-balance text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-muted-foreground">Versi {TERMS_VERSION}</p>
        </header>
        {children}
      </article>
    </Container>
  );
}

export { LegalDocument };
