import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const envMock = vi.hoisted(() => ({ GOOGLE_PLACES_API_KEY: "server-key" as string | undefined }));

vi.mock("@/lib/env", () => ({ env: envMock }));

const { autocompletePlaces, fetchPlaceAddress, placesEnabled } = await import("@/server/places");

const fetchMock = vi.fn();

beforeEach(() => {
  envMock.GOOGLE_PLACES_API_KEY = "server-key";
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe("places proxy", () => {
  it("is disabled and never calls Google without a key", async () => {
    envMock.GOOGLE_PLACES_API_KEY = undefined;

    expect(placesEnabled()).toBe(false);
    await expect(autocompletePlaces("gedung sate", "tok-12345678")).resolves.toEqual({ ok: false, reason: "DISABLED" });
    await expect(fetchPlaceAddress("ChIJabcdefghij", "tok-12345678")).resolves.toEqual({ ok: false, reason: "DISABLED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends autocomplete with session token and Indonesian region, and maps predictions", async () => {
    fetchMock.mockResolvedValue(
      json({
        suggestions: [
          {
            placePrediction: {
              placeId: "ChIJabcdefghij",
              text: { text: "Gedung Sate, Bandung" },
              structuredFormat: { mainText: { text: "Gedung Sate" }, secondaryText: { text: "Bandung" } },
            },
          },
          { queryPrediction: { text: { text: "gedung sate" } } },
        ],
      }),
    );

    const result = await autocompletePlaces("gedung sate", "tok-12345678");

    expect(result).toEqual({ ok: true, data: [{ placeId: "ChIJabcdefghij", name: "Gedung Sate", secondary: "Bandung" }] });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://places.googleapis.com/v1/places:autocomplete");
    expect(init.headers).toMatchObject({ "X-Goog-Api-Key": "server-key" });
    expect(JSON.parse(String(init.body))).toMatchObject({
      input: "gedung sate",
      sessionToken: "tok-12345678",
      languageCode: "id",
      regionCode: "id",
    });
  });

  it("requests only formattedAddress for details, with the session token", async () => {
    fetchMock.mockResolvedValue(json({ formattedAddress: "Jl. Diponegoro No.22, Bandung" }));

    const result = await fetchPlaceAddress("ChIJabcdefghij", "tok-12345678");

    expect(result).toEqual({ ok: true, data: "Jl. Diponegoro No.22, Bandung" });
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe("/v1/places/ChIJabcdefghij");
    expect(url.searchParams.get("sessionToken")).toBe("tok-12345678");
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Goog-FieldMask"]).toBe("formattedAddress");
    expect(headers["X-Goog-FieldMask"]).not.toMatch(/displayName|location|rating/);
  });

  it("reports upstream failures without throwing", async () => {
    fetchMock.mockResolvedValueOnce(json({}, 500));
    await expect(autocompletePlaces("gedung sate", "tok-12345678")).resolves.toEqual({ ok: false, reason: "UPSTREAM" });

    fetchMock.mockRejectedValueOnce(new Error("timeout"));
    await expect(fetchPlaceAddress("ChIJabcdefghij", "tok-12345678")).resolves.toEqual({ ok: false, reason: "UPSTREAM" });
  });
});
