import { describe, expect, it } from "vitest";

import { checkBlocklist, hasForbiddenVisual, normalizeForBlocklist } from "@/lib/ai/blocklist";

describe("checkBlocklist", () => {
  it.each([
    ["nuansa bokep", "SEXUAL"],
    ["B0K3P gratis", "SEXUAL"],
    ["tema cina babi", "HATE"],
    ["white power rally", "HATE"],
    ["pesta ganja", "DRUGS"],
    ["Kokain dan ganja", "DRUGS"],
    ["gambar mutilasi", "VIOLENCE"],
    ["BUNUH mereka semua", "VIOLENCE"],
    ["jual kokain murah", "DRUGS"],
    ["bååååntai", "VIOLENCE"],
  ] as const)("blocks %s as %s", (text, category) => {
    expect(checkBlocklist(text)).toEqual({ blocked: true, category });
  });

  it.each([
    "Pemira BEM Universitas",
    "Google Developer Day",
    "kampanye politik partai, nuansa merah putih",
    "Seksi Acara dan Seksi Humas",
    "Donor darah massal",
    "Workshop Skills for Teachers",
    "seminar anti narkoba",
    "Seminar Anti Narkoba: Tolak Ganja dan Sabu",
    "Webinar Bahaya Narkoba Ecstasy",
    "Sabu Raijua Festival",
    "Turnamen Weed Cup",
    "Workshop Kill Bill Film Night",
    "Pelatihan Gore-Tex",
    "Pameran Seni Nude Drawing",
    "Stop Kekerasan: Bunuh Diri Prevention",
    "Murder Mystery Night",
    "Nike Run Club 2026",
    "kesehatan, nuansa daun dan hijau segar",
    "",
  ])("lets %j pass", (text) => {
    expect(checkBlocklist(text)).toEqual({ blocked: false });
  });

  it("normalizes diacritics, leetspeak and repeated characters", () => {
    expect(normalizeForBlocklist("  Pórn0oo!!  ")).toBe("porno");
  });
});

describe("hasForbiddenVisual", () => {
  it("flags hexagram wording but not Islamic star patterns", () => {
    expect(hasForbiddenVisual("gold hexagram border")).toBe(true);
    expect(hasForbiddenVisual("six-pointed stars")).toBe(true);
    expect(hasForbiddenVisual("Islamic 8-point star tessellation")).toBe(false);
  });
});
