import "server-only";

import { env } from "@/lib/env";

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const DETAILS_URL = "https://places.googleapis.com/v1/places";
const DETAILS_FIELD_MASK = "formattedAddress";
const REQUEST_TIMEOUT_MS = 5000;

export const MIN_QUERY_LENGTH = 3;
export const MAX_QUERY_LENGTH = 120;

export type PlaceSuggestion = { placeId: string; name: string; secondary: string };

export type PlacesResult<T> = { ok: true; data: T } | { ok: false; reason: "DISABLED" | "UPSTREAM" };

export function placesEnabled() {
  return !!env.GOOGLE_PLACES_API_KEY;
}

type AutocompleteResponse = {
  suggestions?: {
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
    };
  }[];
};

export async function autocompletePlaces(input: string, sessionToken: string): Promise<PlacesResult<PlaceSuggestion[]>> {
  const apiKey = env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return { ok: false, reason: "DISABLED" };

  try {
    const response = await fetch(AUTOCOMPLETE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey },
      body: JSON.stringify({
        input,
        sessionToken,
        languageCode: "id",
        regionCode: "id",
        includedRegionCodes: ["id"],
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) return { ok: false, reason: "UPSTREAM" };

    const body = (await response.json()) as AutocompleteResponse;
    const suggestions = (body.suggestions ?? []).flatMap((suggestion) => {
      const prediction = suggestion.placePrediction;
      const fullText = prediction?.text?.text;
      if (!prediction?.placeId || !fullText) return [];
      return [
        {
          placeId: prediction.placeId,
          name: prediction.structuredFormat?.mainText?.text ?? fullText,
          secondary: prediction.structuredFormat?.secondaryText?.text ?? "",
        },
      ];
    });
    return { ok: true, data: suggestions };
  } catch {
    return { ok: false, reason: "UPSTREAM" };
  }
}

export async function fetchPlaceAddress(placeId: string, sessionToken: string): Promise<PlacesResult<string | null>> {
  const apiKey = env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return { ok: false, reason: "DISABLED" };

  try {
    const url = new URL(`${DETAILS_URL}/${encodeURIComponent(placeId)}`);
    url.searchParams.set("sessionToken", sessionToken);
    url.searchParams.set("languageCode", "id");
    url.searchParams.set("regionCode", "id");
    const response = await fetch(url, {
      headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": DETAILS_FIELD_MASK },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) return { ok: false, reason: "UPSTREAM" };

    const body = (await response.json()) as { formattedAddress?: string };
    return { ok: true, data: body.formattedAddress ?? null };
  } catch {
    return { ok: false, reason: "UPSTREAM" };
  }
}
