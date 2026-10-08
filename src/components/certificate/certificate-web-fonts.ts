import localFont from "next/font/local";

import type { FontKey } from "@/lib/certificate-layout";

const prata = localFont({
  src: [{ path: "../../../assets/fonts/prata-400.ttf", weight: "400" }],
  display: "swap",
  preload: false,
});

const cinzel = localFont({
  src: [{ path: "../../../assets/fonts/cinzel-700.ttf", weight: "700" }],
  display: "swap",
  preload: false,
});

const crimson = localFont({
  src: [
    { path: "../../../assets/fonts/crimson-text-400.ttf", weight: "400" },
    { path: "../../../assets/fonts/crimson-text-700.ttf", weight: "700" },
  ],
  display: "swap",
  preload: false,
});

const jakarta = localFont({
  src: [
    { path: "../../../assets/fonts/plus-jakarta-sans-ext-400.ttf", weight: "400" },
    { path: "../../../assets/fonts/plus-jakarta-sans-ext-700.ttf", weight: "700" },
  ],
  display: "swap",
  preload: false,
});

const greatVibes = localFont({
  src: [{ path: "../../../assets/fonts/great-vibes-400.ttf", weight: "400" }],
  display: "swap",
  preload: false,
});

type WebFont = { family: string; regular: number; bold: number };

export const WEB_FONTS: Record<FontKey, WebFont> = {
  times: { family: '"Times New Roman", Times, serif', regular: 400, bold: 700 },
  helvetica: { family: "Helvetica, Arial, sans-serif", regular: 400, bold: 700 },
  prata: { family: prata.style.fontFamily, regular: 400, bold: 400 },
  cinzel: { family: cinzel.style.fontFamily, regular: 700, bold: 700 },
  crimson: { family: crimson.style.fontFamily, regular: 400, bold: 700 },
  jakarta: { family: jakarta.style.fontFamily, regular: 400, bold: 700 },
  "great-vibes": { family: greatVibes.style.fontFamily, regular: 400, bold: 400 },
};
