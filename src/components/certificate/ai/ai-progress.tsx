import { Check, LoaderCircle } from "lucide-react";

import { AI_PHASES, AI_PHASE_LABELS, type AiPhase } from "@/lib/ai-config";
import { cn } from "cn";

type AiProgressProps = { phase: AiPhase | null };

function AiProgress({ phase }: AiProgressProps) {
  const activeIndex = phase ? AI_PHASES.indexOf(phase) : 0;

  return (
    <section aria-labelledby="ai-progress-title" className="flex flex-col gap-4 rounded-xl border border-border p-5">
      <h2 id="ai-progress-title" className="text-base font-semibold">
        Sedang membuat desain
      </h2>
      <div
        aria-hidden="true"
        className="aspect-297/210 w-full max-w-2xl animate-pulse rounded-lg border border-border bg-muted"
      />
      <ol role="status" aria-live="polite" className="flex flex-col gap-2 text-sm">
        {AI_PHASES.map((key, index) => {
          const done = index < activeIndex;
          const active = index === activeIndex;
          return (
            <li
              key={key}
              aria-current={active ? "step" : undefined}
              className={cn("flex items-center gap-2", active ? "font-medium" : "text-muted-foreground")}
            >
              {done ? (
                <Check className="size-4 text-success" aria-hidden="true" />
              ) : active ? (
                <LoaderCircle className="size-4 animate-spin text-primary" aria-hidden="true" />
              ) : (
                <span className="size-4 rounded-full border border-border" aria-hidden="true" />
              )}
              {AI_PHASE_LABELS[key]}
            </li>
          );
        })}
      </ol>
      <p className="text-sm text-muted-foreground">
        Biasanya sekitar 1 menit. Halaman ini boleh ditutup, hasilnya muncul di riwayat saat kamu kembali.
      </p>
    </section>
  );
}

export { AiProgress };
