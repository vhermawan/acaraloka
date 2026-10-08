import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import fontkit, { type Font } from "@pdf-lib/fontkit";
import { StandardFonts, type PDFDocument, type PDFFont } from "pdf-lib";

import type { CertificateTheme, FontKey, FontRole } from "@/lib/certificate-layout";

export type FontFace = { regular: PDFFont; bold: PDFFont };
export type ThemeFonts = Record<FontRole, FontFace>;

type FontSource =
  | { kind: "standard"; regular: StandardFonts; bold: StandardFonts }
  | { kind: "file"; regular: string; bold: string };

const FONT_SOURCES: Record<FontKey, FontSource> = {
  times: { kind: "standard", regular: StandardFonts.TimesRoman, bold: StandardFonts.TimesRomanBold },
  helvetica: { kind: "standard", regular: StandardFonts.Helvetica, bold: StandardFonts.HelveticaBold },
  prata: { kind: "file", regular: "prata-400.ttf", bold: "prata-400.ttf" },
  cinzel: { kind: "file", regular: "cinzel-700.ttf", bold: "cinzel-700.ttf" },
  crimson: { kind: "file", regular: "crimson-text-400.ttf", bold: "crimson-text-700.ttf" },
  jakarta: { kind: "file", regular: "plus-jakarta-sans-ext-400.ttf", bold: "plus-jakarta-sans-ext-700.ttf" },
  "great-vibes": { kind: "file", regular: "great-vibes-400.ttf", bold: "great-vibes-400.ttf" },
};

const FONT_DIR = join(process.cwd(), "assets/fonts");
const bytesCache = new Map<string, Promise<Uint8Array>>();
const parsedCache = new Map<string, Font>();
const glyphChecks = new WeakMap<PDFFont, (codePoint: number) => boolean>();

function readFontBytes(file: string): Promise<Uint8Array> {
  let cached = bytesCache.get(file);
  if (!cached) {
    cached = readFile(join(FONT_DIR, file));
    bytesCache.set(file, cached);
  }
  return cached;
}

function parseFont(file: string, bytes: Uint8Array): Font {
  let parsed = parsedCache.get(file);
  if (!parsed) {
    parsed = fontkit.create(bytes) as Font;
    parsedCache.set(file, parsed);
  }
  return parsed;
}

export function hasGlyph(font: PDFFont, codePoint: number): boolean | null {
  const check = glyphChecks.get(font);
  return check ? check(codePoint) : null;
}

export async function loadThemeFonts(pdf: PDFDocument, theme: CertificateTheme): Promise<ThemeFonts> {
  pdf.registerFontkit(fontkit);
  const embedded = new Map<string, PDFFont>();

  async function embed(source: FontSource, weight: "regular" | "bold"): Promise<PDFFont> {
    const id = source[weight];
    const existing = embedded.get(id);
    if (existing) return existing;
    let font: PDFFont;
    if (source.kind === "standard") {
      font = await pdf.embedFont(source[weight] as StandardFonts);
    } else {
      const bytes = await readFontBytes(source[weight]);
      const parsed = parseFont(source[weight], bytes);
      font = await pdf.embedFont(bytes, { subset: true });
      glyphChecks.set(font, (codePoint) => parsed.hasGlyphForCodePoint(codePoint));
    }
    embedded.set(id, font);
    return font;
  }

  async function face(key: FontKey): Promise<FontFace> {
    const source = FONT_SOURCES[key];
    return { regular: await embed(source, "regular"), bold: await embed(source, "bold") };
  }

  return {
    heading: await face(theme.fonts.heading),
    name: await face(theme.fonts.name),
    body: await face(theme.fonts.body),
  };
}
