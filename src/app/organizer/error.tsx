"use client";

import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LEGAL_OPERATOR } from "@/lib/legal";

export default function OrganizerError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <section role="alert" className="flex flex-col items-start gap-4 rounded-xl border border-destructive/30 bg-destructive/5 p-6">
      <TriangleAlert className="size-6 text-destructive" strokeWidth={1.5} aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold">Halaman ini gagal dimuat</h2>
        <p className="text-sm text-muted-foreground">
          Koneksi ke server mungkin terputus. Coba muat ulang. Kalau masih gagal, hubungi admin di {LEGAL_OPERATOR.email}.
        </p>
      </div>
      <Button variant="outline" onClick={() => retry()} className="h-10 px-4">
        Muat ulang
      </Button>
    </section>
  );
}
