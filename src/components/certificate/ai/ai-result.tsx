"use client";

import Image from "next/image";
import { ExternalLink } from "lucide-react";

import { AiLogoPicker, type LogoOption } from "@/components/certificate/ai/ai-logo-picker";
import { AiResultActions } from "@/components/certificate/ai/ai-result-actions";
import { Button } from "@/components/ui/button";
import type { AiDesignState } from "@/server/ai/overview";
import { cn } from "cn";

export type ResultOption = { id: string; createdAt: string; styleLabel: string; thumbUrl: string | null; used: boolean };

type AiResultProps = {
  eventId: string;
  results: ResultOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  logos: LogoOption[];
  logoPath: string | null;
  onLogoChange: (path: string | null) => void;
  design: AiDesignState;
  reportAvailable: boolean;
};

function AiResult({
  eventId,
  results,
  selectedId,
  onSelect,
  logos,
  logoPath,
  onLogoChange,
  design,
  reportAvailable,
}: AiResultProps) {
  const selected = results.find((result) => result.id === selectedId) ?? results[0];
  const previewUrl = `/organizer/events/${eventId}/certificate/ai/${selected.id}/preview?logo=${encodeURIComponent(logoPath ?? "none")}`;

  return (
    <section aria-labelledby="ai-result-title" className="flex flex-col gap-5 rounded-xl border border-border p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="ai-result-title" className="text-base font-semibold">
          Pratinjau sertifikat
        </h2>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5"
          nativeButton={false}
          render={<a href={previewUrl} target="_blank" rel="noopener" />}
        >
          <ExternalLink aria-hidden="true" />
          Perbesar
          <span className="sr-only">(tab baru)</span>
        </Button>
      </div>

      <iframe
        key={previewUrl}
        src={previewUrl}
        title="Pratinjau sertifikat dengan data contoh"
        className="aspect-297/210 w-full max-w-3xl rounded-lg border border-border bg-muted"
      />
      <p className="text-xs text-muted-foreground">
        Pratinjau memakai nama contoh &quot;Rina Pratama&quot; dan data acara asli. Nama, nomor, tanda tangan, dan QR ditulis
        oleh Acaraloka, bukan AI.
      </p>

      <AiLogoPicker eventId={eventId} idPrefix="ai-result-logo" logos={logos} value={logoPath} onChange={onLogoChange} />

      <AiResultActions
        key={selected.id}
        eventId={eventId}
        generationId={selected.id}
        used={selected.used}
        logoPath={logoPath}
        design={design}
        reportAvailable={reportAvailable}
      />

      {results.length > 1 ? (
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <span id="ai-history-label" className="text-sm font-medium">
            Riwayat hasil acara ini
          </span>
          <ul aria-labelledby="ai-history-label" className="flex flex-wrap gap-3">
            {results.map((result, index) => (
              <li key={result.id}>
                <button
                  type="button"
                  aria-pressed={result.id === selected.id}
                  onClick={() => onSelect(result.id)}
                  className={cn(
                    "flex w-36 flex-col gap-1 rounded-lg border border-border p-1.5 text-left text-xs transition-colors hover:bg-muted",
                    "aria-pressed:border-primary aria-pressed:bg-primary/8",
                  )}
                >
                  <span className="relative block aspect-297/210 w-full overflow-hidden rounded bg-muted">
                    {result.thumbUrl ? (
                      <Image src={result.thumbUrl} alt="" fill sizes="144px" unoptimized className="object-cover" />
                    ) : null}
                  </span>
                  <span className="font-medium">Hasil {results.length - index}</span>
                  <span className="text-muted-foreground">{result.styleLabel}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export { AiResult };
