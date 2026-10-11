"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

import { getPlaceAddress, searchPlaces } from "@/app/organizer/events/place-actions";
import { Input } from "@/components/ui/input";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 3;

type PickedPlace = { placeId: string; name: string; address: string };

type Suggestion = { placeId: string; name: string; secondary: string };

type PlaceSearchProps = {
  onPick: (place: PickedPlace) => void;
};

const ERROR_MESSAGES = {
  RATE_LIMITED: "Terlalu banyak pencarian. Tunggu sebentar lalu coba lagi, atau isi nama dan alamat manual.",
  FAILED: "Pencarian tempat sedang bermasalah. Isi nama dan alamat secara manual.",
  DISABLED: "",
} as const;

function newSessionToken() {
  return crypto.randomUUID();
}

function PlaceSearch({ onPick }: PlaceSearchProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const sessionToken = useRef<string | null>(null);
  const latest = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    const ticket = ++latest.current;
    if (trimmed.length < MIN_QUERY_LENGTH) return;
    const timer = setTimeout(async () => {
      sessionToken.current ??= newSessionToken();
      const result = await searchPlaces(trimmed, sessionToken.current);
      if (ticket !== latest.current) return;
      if (result.ok) {
        setSuggestions(result.suggestions);
        setMessage(result.suggestions.length === 0 ? "Tempat tidak ditemukan. Isi nama dan alamat manual." : "");
      } else {
        setSuggestions([]);
        setMessage(ERROR_MESSAGES[result.error]);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  async function pick(suggestion: Suggestion) {
    const token = sessionToken.current ?? newSessionToken();
    setBusy(true);
    const result = await getPlaceAddress(suggestion.placeId, token);
    setBusy(false);
    sessionToken.current = null;
    latest.current++;
    setSuggestions([]);
    setQuery("");
    setMessage(result.ok ? "" : ERROR_MESSAGES[result.error]);
    onPick({
      placeId: suggestion.placeId,
      name: suggestion.name,
      address: result.ok ? (result.address ?? suggestion.secondary) : suggestion.secondary,
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Input
        type="search"
        role="combobox"
        aria-expanded={suggestions.length > 0}
        aria-controls="place-suggestions"
        aria-autocomplete="list"
        autoComplete="off"
        placeholder="Cari tempat di Google Maps, contoh: Gedung Sate Bandung"
        aria-label="Cari tempat"
        className="h-10"
        value={query}
        onChange={(event) => {
          const value = event.target.value;
          setQuery(value);
          if (value.trim().length < MIN_QUERY_LENGTH) {
            setSuggestions([]);
            setMessage("");
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.preventDefault();
        }}
      />
      {message ? (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}
      {suggestions.length > 0 ? (
        <ul id="place-suggestions" role="listbox" aria-label="Hasil pencarian tempat" className="rounded-lg border border-border">
          {suggestions.map((suggestion) => (
            <li key={suggestion.placeId} role="option" aria-selected={false}>
              <button
                type="button"
                disabled={busy}
                onClick={() => pick(suggestion)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none disabled:opacity-50"
              >
                <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block font-medium wrap-break-word">{suggestion.name}</span>
                  {suggestion.secondary ? (
                    <span className="block text-muted-foreground wrap-break-word">{suggestion.secondary}</span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export { PlaceSearch };
