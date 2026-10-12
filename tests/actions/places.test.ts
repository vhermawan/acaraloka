import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recordError: vi.fn(async () => undefined),
  requireOrganizer: vi.fn(),
  autocompletePlaces: vi.fn(),
  fetchPlaceAddress: vi.fn(),
}));

vi.mock("next/navigation", async () => (await import("../mocks/next-navigation")).nextNavigationMock);
vi.mock("@/server/error-log", () => ({ recordError: mocks.recordError }));
vi.mock("@/server/authz", () => ({ requireOrganizer: mocks.requireOrganizer }));
vi.mock("@/server/places", () => ({
  MIN_QUERY_LENGTH: 3,
  MAX_QUERY_LENGTH: 120,
  autocompletePlaces: mocks.autocompletePlaces,
  fetchPlaceAddress: mocks.fetchPlaceAddress,
}));

const { searchPlaces, getPlaceAddress } = await import("@/actions/places");

const TOKEN = "11111111-2222-3333-4444-555555555555";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireOrganizer.mockResolvedValue({ user: { id: "u1" } });
});

describe("place actions", () => {
  it("rejects callers without an organizer session before touching Google", async () => {
    mocks.requireOrganizer.mockRejectedValue(new Error("REDIRECT:/organizer/login"));

    await expect(searchPlaces("gedung sate", TOKEN)).rejects.toThrow("REDIRECT");
    await expect(getPlaceAddress("ChIJabcdefghij", TOKEN)).rejects.toThrow("REDIRECT");
    expect(mocks.autocompletePlaces).not.toHaveBeenCalled();
    expect(mocks.fetchPlaceAddress).not.toHaveBeenCalled();
  });

  it("ignores queries shorter than 3 characters and bad tokens", async () => {
    await expect(searchPlaces(" ab ", TOKEN)).resolves.toEqual({ ok: false, error: "FAILED" });
    await expect(searchPlaces("gedung sate", "x")).resolves.toEqual({ ok: false, error: "FAILED" });
    await expect(getPlaceAddress("../etc", TOKEN)).resolves.toEqual({ ok: false, error: "FAILED" });
    expect(mocks.autocompletePlaces).not.toHaveBeenCalled();
    expect(mocks.fetchPlaceAddress).not.toHaveBeenCalled();
  });

  it("returns suggestions and the address", async () => {
    mocks.autocompletePlaces.mockResolvedValue({ ok: true, data: [{ placeId: "p", name: "n", secondary: "s" }] });
    mocks.fetchPlaceAddress.mockResolvedValue({ ok: true, data: "Alamat" });

    await expect(searchPlaces("gedung sate", TOKEN)).resolves.toEqual({
      ok: true,
      suggestions: [{ placeId: "p", name: "n", secondary: "s" }],
    });
    await expect(getPlaceAddress("ChIJabcdefghij", TOKEN)).resolves.toEqual({ ok: true, address: "Alamat" });
  });

  it("maps a disabled proxy and upstream failure", async () => {
    mocks.autocompletePlaces.mockResolvedValue({ ok: false, reason: "DISABLED" });
    await expect(searchPlaces("gedung sate", TOKEN)).resolves.toEqual({ ok: false, error: "DISABLED" });

    mocks.fetchPlaceAddress.mockResolvedValue({ ok: false, reason: "UPSTREAM" });
    await expect(getPlaceAddress("ChIJabcdefghij", TOKEN)).resolves.toEqual({ ok: false, error: "FAILED" });
  });

  it("rate limits search per user", async () => {
    mocks.requireOrganizer.mockResolvedValue({ user: { id: "heavy" } });
    mocks.autocompletePlaces.mockResolvedValue({ ok: true, data: [] });

    const results = [];
    for (let i = 0; i < 31; i++) results.push(await searchPlaces("gedung sate", TOKEN));

    expect(results.slice(0, 30).every((result) => result.ok)).toBe(true);
    expect(results[30]).toEqual({ ok: false, error: "RATE_LIMITED" });
    expect(mocks.autocompletePlaces).toHaveBeenCalledTimes(30);

    mocks.requireOrganizer.mockResolvedValue({ user: { id: "other" } });
    await expect(searchPlaces("gedung sate", TOKEN)).resolves.toMatchObject({ ok: true });
  });
});
