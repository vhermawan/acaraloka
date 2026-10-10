"use server";

import { createRateLimiter } from "@/lib/rate-limit";
import { requireOrganizer } from "@/server/authz";
import {
  MAX_QUERY_LENGTH,
  MIN_QUERY_LENGTH,
  autocompletePlaces,
  fetchPlaceAddress,
  type PlaceSuggestion,
} from "@/server/places";

const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9-]{8,64}$/;
const PLACE_ID_PATTERN = /^[A-Za-z0-9_-]{10,300}$/;

const allowSearch = createRateLimiter({ limit: 30, windowMs: 60_000 });
const allowDetails = createRateLimiter({ limit: 15, windowMs: 60_000 });

export type SearchPlacesResult =
  | { ok: true; suggestions: PlaceSuggestion[] }
  | { ok: false; error: "DISABLED" | "RATE_LIMITED" | "FAILED" };

export type PlaceAddressResult =
  | { ok: true; address: string | null }
  | { ok: false; error: "DISABLED" | "RATE_LIMITED" | "FAILED" };

export async function searchPlaces(query: string, sessionToken: string): Promise<SearchPlacesResult> {
  const { user } = await requireOrganizer();
  const input = query.trim().slice(0, MAX_QUERY_LENGTH);
  if (input.length < MIN_QUERY_LENGTH || !SESSION_TOKEN_PATTERN.test(sessionToken)) return { ok: false, error: "FAILED" };
  if (!allowSearch(user.id)) return { ok: false, error: "RATE_LIMITED" };

  const result = await autocompletePlaces(input, sessionToken);
  if (result.ok) return { ok: true, suggestions: result.data };
  return { ok: false, error: result.reason === "DISABLED" ? "DISABLED" : "FAILED" };
}

export async function getPlaceAddress(placeId: string, sessionToken: string): Promise<PlaceAddressResult> {
  const { user } = await requireOrganizer();
  if (!PLACE_ID_PATTERN.test(placeId) || !SESSION_TOKEN_PATTERN.test(sessionToken)) return { ok: false, error: "FAILED" };
  if (!allowDetails(user.id)) return { ok: false, error: "RATE_LIMITED" };

  const result = await fetchPlaceAddress(placeId, sessionToken);
  if (result.ok) return { ok: true, address: result.data };
  return { ok: false, error: result.reason === "DISABLED" ? "DISABLED" : "FAILED" };
}
