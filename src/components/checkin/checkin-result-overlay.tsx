"use client";

import { useEffect, useRef } from "react";
import { CircleCheck, CircleX, TriangleAlert } from "lucide-react";

import { CHECK_IN_OUTCOME_LABELS, type CheckInResult } from "@/lib/checkin";
import { cn } from "cn";

const TONES = {
  VALID: "bg-green-700 text-white",
  ALREADY_CHECKED_IN: "bg-amber-400 text-amber-950",
  WRONG_EVENT: "bg-red-700 text-white",
  CANCELLED: "bg-red-700 text-white",
  EVENT_CANCELLED: "bg-red-700 text-white",
  INVALID: "bg-red-700 text-white",
} as const;

const HINTS = {
  VALID: "",
  ALREADY_CHECKED_IN: "Tiket ini sudah dipakai masuk.",
  WRONG_EVENT: "Tiket ini terdaftar di acara lain.",
  CANCELLED: "Pendaftaran peserta ini sudah dibatalkan.",
  EVENT_CANCELLED: "Check-in hanya untuk acara yang sedang terbit.",
  INVALID: "Kode tidak dikenali. Minta peserta membuka tiket dari halaman Tiket Saya.",
} as const;

const ICONS = {
  VALID: CircleCheck,
  ALREADY_CHECKED_IN: TriangleAlert,
  WRONG_EVENT: CircleX,
  CANCELLED: CircleX,
  EVENT_CANCELLED: CircleX,
  INVALID: CircleX,
} as const;

export const VALID_AUTO_DISMISS_MS = 1800;

type CheckInResultOverlayProps = {
  result: CheckInResult;
  formatTime: (iso: string) => string;
  onDismiss: () => void;
  onUndo: (registrationId: string) => void;
  undoPending: boolean;
};

function CheckInResultOverlay({ result, formatTime, onDismiss, onUndo, undoPending }: CheckInResultOverlayProps) {
  const dismissRef = useRef<HTMLButtonElement>(null);
  const { outcome, participant } = result;
  const valid = outcome === "VALID";
  const Icon = ICONS[outcome];

  useEffect(() => {
    dismissRef.current?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onDismiss();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onDismiss]);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="checkin-result-title"
      className={cn("fixed inset-0 z-50 flex flex-col justify-between gap-8 px-6 py-10", TONES[outcome])}
    >
      <div className="flex flex-1 flex-col justify-center gap-3">
        <Icon className="size-14" strokeWidth={1.75} aria-hidden="true" />
        <p id="checkin-result-title" className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {CHECK_IN_OUTCOME_LABELS[outcome]}
        </p>
        {participant ? (
          <div className="flex flex-col gap-1">
            <p className="text-2xl font-medium break-words">{participant.name}</p>
            <p className="text-lg opacity-90">{participant.ticketTypeName}</p>
            {!valid && participant.checkedInAt ? (
              <p className="text-lg tabular-nums">Masuk pukul {formatTime(participant.checkedInAt)}</p>
            ) : null}
          </div>
        ) : null}
        {HINTS[outcome] ? <p className="max-w-prose text-base opacity-90">{HINTS[outcome]}</p> : null}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          ref={dismissRef}
          type="button"
          onClick={onDismiss}
          className="h-12 rounded-lg bg-white px-5 text-base font-medium text-neutral-900 outline-offset-4 focus-visible:outline-2 focus-visible:outline-current"
        >
          Scan berikutnya
        </button>
        {valid && participant ? (
          <button
            type="button"
            onClick={() => onUndo(participant.registrationId)}
            disabled={undoPending}
            className="h-12 rounded-lg border border-current px-5 text-base font-medium outline-offset-4 focus-visible:outline-2 focus-visible:outline-current disabled:opacity-70"
          >
            {undoPending ? "Membatalkan..." : "Salah scan, batalkan"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export { CheckInResultOverlay };
