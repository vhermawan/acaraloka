"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type QrScanner from "qr-scanner";
import { Camera, CameraOff } from "lucide-react";
import { toast } from "sonner";

import {
  checkInByCode,
  checkInByRegistration,
  undoParticipantCheckIn,
} from "@/app/organizer/events/[id]/checkin/actions";
import { CheckInResultOverlay, VALID_AUTO_DISMISS_MS } from "@/components/checkin/checkin-result-overlay";
import { CheckInSearch } from "@/components/checkin/checkin-search";
import { playFeedback, unlockAudio } from "@/components/checkin/checkin-feedback";
import { Button } from "@/components/ui/button";
import { CHECK_IN_OUTCOME_LABELS, isDuplicateScan, type CheckInResult } from "@/lib/checkin";

type CameraState = "idle" | "starting" | "active" | "error";

type HistoryItem = {
  id: number;
  result: CheckInResult;
  undone: boolean;
  scannedAt: string;
};

const HISTORY_SIZE = 5;

const OUTCOME_DOTS: Record<CheckInResult["outcome"], string> = {
  VALID: "bg-success",
  ALREADY_CHECKED_IN: "bg-[#CA8A04]",
  WRONG_EVENT: "bg-destructive",
  CANCELLED: "bg-destructive",
  EVENT_CANCELLED: "bg-destructive",
  INVALID: "bg-destructive",
};

function ScanCorners() {
  const corner = "absolute size-8 border-white";
  return (
    <>
      <span className={`${corner} top-0 left-0 rounded-tl-lg border-t-[3px] border-l-[3px]`} />
      <span className={`${corner} top-0 right-0 rounded-tr-lg border-t-[3px] border-r-[3px]`} />
      <span className={`${corner} bottom-0 left-0 rounded-bl-lg border-b-[3px] border-l-[3px]`} />
      <span className={`${corner} right-0 bottom-0 rounded-br-lg border-r-[3px] border-b-[3px]`} />
    </>
  );
}

function cameraErrorMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : String(error);
  if (name === "NotAllowedError" || /permission|denied/i.test(name)) {
    return "Izin kamera ditolak. Izinkan kamera di pengaturan browser, lalu coba lagi.";
  }
  if (!window.isSecureContext) return "Kamera hanya bisa dipakai lewat HTTPS.";
  if (/camera not found|NotFoundError/i.test(name)) return "Kamera tidak ditemukan di perangkat ini.";
  return "Kamera tidak bisa dibuka. Buka halaman ini di Chrome atau Safari, atau pakai pencarian nama di bawah.";
}

type CheckInConsoleProps = {
  eventId: string;
  timezone: string;
};

function CheckInConsole({ eventId, timezone }: CheckInConsoleProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const busyRef = useRef(false);
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);
  const historyIdRef = useRef(0);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [cameraError, setCameraError] = useState("");
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [undoPending, startUndo] = useTransition();
  const [searchVersion, setSearchVersion] = useState(0);

  const formatTime = useCallback(
    (iso: string) =>
      new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: timezone }).format(new Date(iso)),
    [timezone],
  );

  const requestWakeLock = useCallback(async () => {
    if (!("wakeLock" in navigator) || document.visibilityState !== "visible") return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request("screen");
    } catch {
      wakeLockRef.current = null;
    }
  }, []);

  const showResult = useCallback((next: CheckInResult) => {
    playFeedback(next.outcome);
    setResult(next);
    historyIdRef.current += 1;
    const id = historyIdRef.current;
    const scannedAt = new Date().toISOString();
    setHistory((items) => [{ id, result: next, undone: false, scannedAt }, ...items].slice(0, HISTORY_SIZE));
    setSearchVersion((version) => version + 1);
  }, []);

  const runCheckIn = useCallback(
    async (action: () => Promise<CheckInResult>) => {
      busyRef.current = true;
      await scannerRef.current?.pause();
      try {
        showResult(await action());
      } catch {
        toast.error("Gagal menghubungi server. Periksa koneksi lalu scan ulang.");
        busyRef.current = false;
        lastScanRef.current = null;
        void scannerRef.current?.start();
      }
    },
    [showResult],
  );

  const handleDecode = useCallback(
    (data: string) => {
      const now = Date.now();
      if (busyRef.current || isDuplicateScan(lastScanRef.current, data, now)) return;
      lastScanRef.current = { code: data, at: now };
      void runCheckIn(() => checkInByCode(eventId, data));
    },
    [eventId, runCheckIn],
  );

  const dismiss = useCallback(() => {
    setResult(null);
    busyRef.current = false;
    if (lastScanRef.current) lastScanRef.current = { ...lastScanRef.current, at: Date.now() };
    if (scannerRef.current && cameraState === "active") void scannerRef.current.start();
  }, [cameraState]);

  useEffect(() => {
    if (result?.outcome !== "VALID") return;
    const timer = window.setTimeout(dismiss, VALID_AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [result, dismiss]);

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible" && scannerRef.current) void requestWakeLock();
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      scannerRef.current?.destroy();
      scannerRef.current = null;
      void wakeLockRef.current?.release();
    };
  }, [requestWakeLock]);

  async function startCamera() {
    unlockAudio();
    if (!videoRef.current) return;
    setCameraState("starting");
    setCameraError("");
    try {
      if (!scannerRef.current) {
        const { default: Scanner } = await import("qr-scanner");
        scannerRef.current = new Scanner(videoRef.current, (scan) => handleDecode(scan.data), {
          preferredCamera: "environment",
          maxScansPerSecond: 10,
          highlightScanRegion: true,
          overlay: overlayRef.current ?? undefined,
          returnDetailedScanResult: true,
        });
      }
      await scannerRef.current.start();
      setCameraState("active");
      void requestWakeLock();
    } catch (error) {
      scannerRef.current?.destroy();
      scannerRef.current = null;
      setCameraState("error");
      setCameraError(cameraErrorMessage(error));
    }
  }

  function stopCamera() {
    scannerRef.current?.stop();
    setCameraState("idle");
    void wakeLockRef.current?.release();
    wakeLockRef.current = null;
  }

  function handleUndo(registrationId: string) {
    startUndo(async () => {
      const response = await undoParticipantCheckIn(eventId, registrationId);
      if (response.error) {
        toast.error(response.error);
        return;
      }
      toast.success("Check-in dibatalkan.");
      setHistory((items) =>
        items.map((item) =>
          item.result.participant?.registrationId === registrationId && item.result.outcome === "VALID"
            ? { ...item, undone: true }
            : item,
        ),
      );
      setSearchVersion((version) => version + 1);
      if (result) dismiss();
    });
  }

  function handleManualCheckIn(registrationId: string) {
    unlockAudio();
    void runCheckIn(() => checkInByRegistration(eventId, registrationId));
  }

  const cameraOn = cameraState === "active" || cameraState === "starting";

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-10">
      <section aria-labelledby="scanner-heading" className="flex flex-col gap-4">
        <h2 id="scanner-heading" className="text-lg/[26px] font-semibold">
          Scan QR tiket
        </h2>
        <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-neutral-900">
          <video
            ref={videoRef}
            muted
            playsInline
            aria-label="Pratinjau kamera"
            className={cameraOn ? "size-full object-cover" : "hidden"}
          />
          <div ref={overlayRef} aria-hidden="true" className={cameraOn ? "hidden" : "invisible hidden"}>
            <ScanCorners />
          </div>
          {!cameraOn ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-6 text-center text-neutral-100">
              <div aria-hidden="true" className="absolute inset-[18%]">
                <ScanCorners />
              </div>
              {cameraState === "error" ? (
                <CameraOff className="relative size-7 text-neutral-300" strokeWidth={1.5} aria-hidden="true" />
              ) : null}
              <p className="relative max-w-xs text-sm text-pretty" role={cameraState === "error" ? "alert" : undefined}>
                {cameraState === "error"
                  ? cameraError
                  : "Arahkan kamera belakang ke QR di tiket peserta. Layar tetap menyala selama scanner aktif."}
              </p>
              <Button className="relative h-11 gap-2 px-5" onClick={startCamera}>
                <Camera aria-hidden="true" />
                {cameraState === "error" ? "Coba buka kamera lagi" : "Nyalakan kamera"}
              </Button>
            </div>
          ) : null}
          {cameraState === "starting" ? (
            <p className="absolute inset-x-0 bottom-4 text-center text-sm text-neutral-100" role="status">
              Membuka kamera...
            </p>
          ) : null}
        </div>
        {cameraState === "active" ? (
          <Button variant="outline" className="h-11 self-start px-4" onClick={stopCamera}>
            Matikan kamera
          </Button>
        ) : null}
      </section>

      <div className="flex min-w-0 flex-col gap-8">
        <section aria-labelledby="recent-heading" className="flex flex-col gap-3">
          <h2 id="recent-heading" className="text-lg/[26px] font-semibold">
            Scan terakhir
          </h2>
          {history.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              Belum ada tiket yang di-scan di perangkat ini.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
              {history.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span
                    aria-hidden="true"
                    className={`size-2 shrink-0 rounded-full ${item.undone ? "bg-muted-foreground" : OUTCOME_DOTS[item.result.outcome]}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{item.result.participant?.name ?? "Tanpa nama"}</p>
                    <p className="text-muted-foreground">
                      <span className="tabular-nums">{formatTime(item.scannedAt)}</span>
                      {" · "}
                      {item.undone ? "Check-in dibatalkan" : CHECK_IN_OUTCOME_LABELS[item.result.outcome]}
                    </p>
                  </div>
                  {item.result.outcome === "VALID" && !item.undone && item.result.participant ? (
                    <Button
                      variant="ghost"
                      className="h-11 shrink-0 px-3 text-destructive hover:bg-destructive/5 hover:text-destructive"
                      disabled={undoPending}
                      onClick={() => handleUndo(item.result.participant!.registrationId)}
                    >
                      Batalkan
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <CheckInSearch
          eventId={eventId}
          formatTime={formatTime}
          refreshKey={searchVersion}
          onCheckIn={handleManualCheckIn}
          onUndo={handleUndo}
          undoPending={undoPending}
        />
      </div>

      {result ? (
        <CheckInResultOverlay
          result={result}
          formatTime={formatTime}
          onDismiss={dismiss}
          onUndo={handleUndo}
          undoPending={undoPending}
        />
      ) : null}
    </div>
  );
}

export { CheckInConsole };
