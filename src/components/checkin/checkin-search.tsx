"use client";

import { useEffect, useState } from "react";

import { searchParticipants } from "@/app/organizer/events/[id]/checkin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SearchRow = Awaited<ReturnType<typeof searchParticipants>>[number];

type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "done"; rows: SearchRow[] };

const SEARCH_DEBOUNCE_MS = 300;

type CheckInSearchProps = {
  eventId: string;
  formatTime: (iso: string) => string;
  refreshKey: number;
  onCheckIn: (registrationId: string) => void;
  onUndo: (registrationId: string) => void;
  undoPending: boolean;
};

function CheckInSearch({ eventId, formatTime, refreshKey, onCheckIn, onUndo, undoPending }: CheckInSearchProps) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < 2) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setState((current) => (current.status === "done" ? current : { status: "loading" }));
      try {
        const rows = await searchParticipants(eventId, trimmed);
        if (!cancelled) setState({ status: "done", rows });
      } catch {
        if (!cancelled) setState({ status: "error" });
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [eventId, trimmed, refreshKey]);

  const view = trimmed.length < 2 ? { status: "idle" as const } : state;

  return (
    <section aria-labelledby="search-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="search-heading" className="text-lg font-semibold">
          Cari peserta
        </h2>
        <p className="text-sm text-muted-foreground">Untuk peserta yang QR-nya tidak terbaca atau tidak membawa HP.</p>
      </div>
      <div>
        <label htmlFor="checkin-search" className="sr-only">
          Nama, email, atau nomor HP
        </label>
        <Input
          id="checkin-search"
          type="search"
          autoComplete="off"
          placeholder="Nama, email, atau nomor HP"
          className="h-11"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div aria-live="polite">
        {view.status === "idle" ? (
          <p className="text-sm text-muted-foreground">Ketik minimal 2 huruf.</p>
        ) : null}
        {view.status === "loading" ? (
          <p className="text-sm text-muted-foreground" role="status">
            Mencari...
          </p>
        ) : null}
        {view.status === "error" ? (
          <p className="text-sm text-destructive">Pencarian gagal. Periksa koneksi lalu ketik ulang.</p>
        ) : null}
        {view.status === "done" && view.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tidak ada peserta aktif yang cocok dengan &ldquo;{trimmed}&rdquo;.</p>
        ) : null}
        {view.status === "done" && view.rows.length > 0 ? (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {view.rows.map((row) => (
              <li key={row.registrationId} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0 text-sm">
                  <p className="truncate font-medium">{row.name}</p>
                  <p className="truncate text-muted-foreground">
                    {row.email} · {row.ticketTypeName}
                  </p>
                  {row.checkedInAt ? (
                    <p className="text-muted-foreground tabular-nums">Hadir pukul {formatTime(row.checkedInAt)}</p>
                  ) : null}
                </div>
                {row.checkedInAt ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-11 shrink-0"
                    disabled={undoPending}
                    onClick={() => onUndo(row.registrationId)}
                  >
                    Batalkan check-in
                  </Button>
                ) : (
                  <Button size="sm" className="h-11 shrink-0 px-4" onClick={() => onCheckIn(row.registrationId)}>
                    Check-in
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

export { CheckInSearch };
