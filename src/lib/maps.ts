type MapsPlace = { name: string | null; address: string | null; placeId: string | null };

export function mapsSearchUrl(place: MapsPlace): string | null {
  const query = [place.name, place.address].filter(Boolean).join(", ");
  if (!query) return null;
  const params = new URLSearchParams({ api: "1", query });
  if (place.placeId) params.set("query_place_id", place.placeId);
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

export function mapsEmbedUrl(placeId: string | null, apiKey: string | undefined): string | null {
  if (!placeId || !apiKey) return null;
  const params = new URLSearchParams({ key: apiKey, q: `place_id:${placeId}` });
  return `https://www.google.com/maps/embed/v1/place?${params.toString()}`;
}
