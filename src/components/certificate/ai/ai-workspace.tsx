"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { startAiGeneration, type AiStartState } from "@/actions/event-certificate-ai";
import { AiForm } from "@/components/certificate/ai/ai-form";
import { AiLogoPicker, type LogoOption } from "@/components/certificate/ai/ai-logo-picker";
import { AiProgress } from "@/components/certificate/ai/ai-progress";
import { AiResult, type ResultOption } from "@/components/certificate/ai/ai-result";
import { Button } from "@/components/ui/button";
import {
  AI_POLL_LOST_MESSAGE,
  AI_POLL_MAX_FAILURES,
  AI_STATUS_POLL_MS,
  AI_UNAVAILABLE_CODE,
  type AiPhase,
} from "@/lib/ai-config";
import type { StoredInput } from "@/lib/ai/generate-input";
import type { AiStatusPayload } from "@/lib/ai/status";
import type { AiDesignState } from "@/server/ai/overview";

const FORM_ID = "ai-generate-form";

type AiWorkspaceProps = {
  eventId: string;
  accessMessage: string | null;
  formEnabled: boolean;
  eventRemaining: number;
  dayRemaining: number;
  running: { id: string; phase: AiPhase | null } | null;
  failure: { id: string; message: string } | null;
  defaults: StoredInput;
  results: ResultOption[];
  logos: LogoOption[];
  design: AiDesignState;
  reportAvailable: boolean;
};

function Notice({ children, tone = "warning" }: { children: React.ReactNode; tone?: "warning" | "error" }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className="flex gap-3 rounded-lg border border-border bg-muted/40 p-4 text-sm"
    >
      <TriangleAlert className="mt-0.5 size-5 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
      <div className="min-w-0 wrap-break-word">{children}</div>
    </div>
  );
}

function AiWorkspace({
  eventId,
  accessMessage,
  formEnabled,
  eventRemaining,
  dayRemaining,
  running,
  failure,
  defaults,
  results,
  logos,
  design,
  reportAvailable,
}: AiWorkspaceProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<AiStartState, FormData>(startAiGeneration.bind(null, eventId), {});
  const [finished, setFinished] = useState<string[]>([]);
  const [outcome, setOutcome] = useState<{ id: string; message: string; lost?: boolean } | null>(null);
  const [phase, setPhase] = useState<AiPhase | null>(running?.phase ?? null);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [logoPath, setLogoPath] = useState<string | null>(null);

  const watchingId = [state.generationId, running?.id].find((id) => id && !finished.includes(id)) ?? null;
  const lastFinished = finished.at(-1) ?? null;
  const shownFailure = watchingId ? null : outcome && outcome.id === lastFinished ? outcome : failure;
  const selectedId = results.find((result) => result.id === chosenId)?.id ?? results[0]?.id ?? null;
  const unavailable = state.code === AI_UNAVAILABLE_CODE;
  const formDisabled = !formEnabled || pending || watchingId !== null || unavailable;
  const selectedLogo = logos.some((logo) => logo.path === logoPath) ? logoPath : null;

  useEffect(() => {
    const generationId = watchingId;
    if (!generationId) return;
    let cancelled = false;
    let inFlight = false;
    let failures = 0;
    const markFailure = () => {
      failures += 1;
      if (failures < AI_POLL_MAX_FAILURES) return;
      cancelled = true;
      setFinished((current) => [...current, generationId]);
      setOutcome({ id: generationId, message: AI_POLL_LOST_MESSAGE, lost: true });
    };

    const poll = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const response = await fetch(`/organizer/events/${eventId}/certificate/ai/${generationId}/status`, {
          cache: "no-store",
        });
        if (cancelled) return;
        if (!response.ok || response.redirected) {
          markFailure();
          return;
        }
        const payload = (await response.json()) as AiStatusPayload;
        if (cancelled) return;
        failures = 0;
        if (payload.status === "RUNNING") {
          setPhase(payload.phase);
          return;
        }
        setFinished((current) => [...current, generationId]);
        if (payload.status === "SUCCEEDED") {
          setChosenId(generationId);
          toast.success("Desain siap. Cek pratinjaunya.");
        } else {
          setOutcome({ id: generationId, message: payload.message });
        }
        router.refresh();
      } catch {
        markFailure();
      } finally {
        inFlight = false;
      }
    };

    const timer = setInterval(() => void poll(), AI_STATUS_POLL_MS);
    void poll();
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [watchingId, eventId, router]);

  function retry() {
    const form = document.getElementById(FORM_ID);
    if (form instanceof HTMLFormElement) form.requestSubmit();
  }

  if (unavailable) {
    return (
      <div className="flex flex-col items-start gap-4">
        <Notice tone="error">{state.message}</Notice>
        <Button variant="outline" className="h-10 px-4" nativeButton={false} render={<Link href={`/organizer/events/${eventId}/certificate`} />}>
          Kembali ke Sertifikat
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {accessMessage ? <Notice>{accessMessage}</Notice> : null}
      {state.message && !state.errors ? <Notice tone="error">{state.message}</Notice> : null}
      {shownFailure ? (
        <Notice tone="error">
          <p>{shownFailure.message}</p>
          {"lost" in shownFailure && shownFailure.lost ? (
            <Button type="button" variant="outline" size="sm" className="mt-3 h-9 px-3" onClick={() => window.location.reload()}>
              Muat ulang halaman
            </Button>
          ) : formEnabled ? (
            <Button type="button" variant="outline" size="sm" className="mt-3 h-9 px-3" onClick={retry}>
              Coba lagi
            </Button>
          ) : null}
        </Notice>
      ) : null}

      {watchingId ? <AiProgress phase={phase} /> : null}

      {!watchingId && selectedId ? (
        <AiResult
          eventId={eventId}
          results={results}
          selectedId={selectedId}
          onSelect={setChosenId}
          logos={logos}
          logoPath={selectedLogo}
          onLogoChange={setLogoPath}
          design={design}
          reportAvailable={reportAvailable}
        />
      ) : null}

      <section aria-labelledby="ai-form-title" className="flex flex-col gap-4 rounded-xl border border-border p-5">
        <div className="flex flex-col gap-1">
          <h2 id="ai-form-title" className="text-base font-semibold">
            {results.length > 0 ? "Buat ulang desain" : "Buat desain dengan AI"}
          </h2>
          {results.length === 0 && !watchingId ? (
            <p className="text-sm text-muted-foreground">Hasil pertama muncul dalam sekitar 1 menit.</p>
          ) : null}
        </div>
        <AiForm
          formId={FORM_ID}
          defaults={defaults}
          dispatch={formAction}
          pending={pending}
          disabled={formDisabled}
          serverErrors={state.errors}
          eventRemaining={eventRemaining}
          dayRemaining={dayRemaining}
          hasResults={results.length > 0}
          logoField={
            <AiLogoPicker eventId={eventId} idPrefix="ai-form-logo" logos={logos} value={selectedLogo} onChange={setLogoPath} />
          }
        />
      </section>
    </div>
  );
}

export { AiWorkspace };
