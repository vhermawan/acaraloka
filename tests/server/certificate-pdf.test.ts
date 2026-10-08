import { PDFDict, PDFDocument, PDFName, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";

import {
  BORDER_PRESETS,
  defaultCertificateLayout,
  parseCertificateLayout,
  type BorderKey,
  type CertificateTheme,
} from "@/lib/certificate-layout";
import { loadThemeFonts } from "@/server/certificate-fonts";
import { fitFontSize, renderCertificatePdf, sanitizeForFont } from "@/server/certificate-pdf";

const PNG_1X1 = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="),
  (char) => char.charCodeAt(0),
);

const data = {
  recipientName: "Siti Nurhaliza Ramadhani",
  certificateNumber: "EI-2610-0001-K7Q3XM",
  eventTitle: "Workshop Desain Produk",
  eventDate: "7 Oktober 2026",
  organizerName: "Himpunan Mahasiswa",
  verifyUrl: "https://acaraloka.example/v/EI-2610-0001-K7Q3XM",
  signers: [
    { name: "Dr. Budi Santoso", title: "Ketua Pelaksana", signaturePng: PNG_1X1 },
    { name: "Ayu Lestari", title: "Narasumber", signaturePng: null },
  ],
};

async function embeddedFontNames(bytes: Uint8Array): Promise<string[]> {
  const pdf = await PDFDocument.load(bytes);
  const names: string[] = [];
  for (const [, object] of pdf.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFDict)) continue;
    if (object.get(PDFName.of("Type")) !== PDFName.of("Font")) continue;
    const base = object.get(PDFName.of("BaseFont"));
    if (base instanceof PDFName) names.push(base.decodeText().replace(/^[A-Z]{6}\+/, ""));
  }
  return names;
}

function themed(theme: Partial<CertificateTheme>) {
  const layout = defaultCertificateLayout(2);
  return { ...layout, theme: { ...layout.theme, ...theme } };
}

describe("renderCertificatePdf", () => {
  it("renders a one page A4 landscape PDF", async () => {
    const bytes = await renderCertificatePdf(defaultCertificateLayout(2), data, { watermark: "PRATINJAU" });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    const { width, height } = pdf.getPage(0).getSize();
    expect(Math.round(width)).toBe(842);
    expect(Math.round(height)).toBe(595);
  });

  it("does not crash on characters outside the standard font", async () => {
    const bytes = await renderCertificatePdf(defaultCertificateLayout(1), {
      ...data,
      recipientName: "Nguyễn Thị Ánh 李",
      signers: [],
    });
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });
});

describe("certificate themes", () => {
  it.each(Object.keys(BORDER_PRESETS) as BorderKey[])("renders the %s border with embedded fonts", async (border) => {
    const bytes = await renderCertificatePdf(
      themed({ border, accent: "burgundy", fonts: { heading: "prata", name: "great-vibes", body: "crimson" } }),
      data,
    );
    expect(bytes.byteLength).toBeGreaterThan(1000);
    const names = await embeddedFontNames(bytes);
    expect(names.some((name) => name.startsWith("Prata"))).toBe(true);
    expect(names.some((name) => name.startsWith("GreatVibes"))).toBe(true);
    expect(names.some((name) => name.startsWith("CrimsonText"))).toBe(true);
  });

  it("keeps the standard fonts for layouts without a theme", async () => {
    const legacy: Record<string, unknown> = { ...defaultCertificateLayout(2) };
    delete legacy.theme;
    const parsed = parseCertificateLayout(legacy);
    const names = await embeddedFontNames(await renderCertificatePdf(parsed, data));
    expect(names.sort()).toEqual(["Helvetica", "Helvetica-Bold", "Times-Bold", "Times-Roman"]);
  });

  it("embeds a subset instead of the whole font file", async () => {
    const bytes = await renderCertificatePdf(
      themed({ fonts: { heading: "cinzel", name: "prata", body: "jakarta" } }),
      data,
    );
    expect(bytes.byteLength).toBeLessThan(150_000);
  });

  it("shrinks long names in a wide script font", async () => {
    const longName = "Muhammad Rizky Pratama Wijaya Kusuma Hadiningrat Saputra";
    const bytes = await renderCertificatePdf(
      themed({ fonts: { heading: "times", name: "great-vibes", body: "helvetica" } }),
      { ...data, recipientName: longName },
    );
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });

  it("keeps Latin Extended characters in fonts that have them and masks the rest", async () => {
    for (const key of ["crimson", "jakarta", "great-vibes"] as const) {
      const pdf = await PDFDocument.create();
      const fonts = await loadThemeFonts(pdf, {
        border: "classic",
        accent: "teal",
        fonts: { heading: "times", name: key, body: "jakarta" },
      });
      expect(sanitizeForFont("Erdős Françoise Łukasz", fonts.name.bold)).toBe("Erdős Françoise Łukasz");
      expect(sanitizeForFont("Ani 😀 李", fonts.name.bold)).toBe("Ani ? ?");
      expect(sanitizeForFont("Erdős Łukasz", fonts.body.bold)).toBe("Erdős Łukasz");
    }
  });

  it("falls back to plain letters when the font lacks the glyph", async () => {
    const pdf = await PDFDocument.create();
    const fonts = await loadThemeFonts(pdf, {
      border: "classic",
      accent: "teal",
      fonts: { heading: "times", name: "prata", body: "helvetica" },
    });
    expect(sanitizeForFont("Erdős Łukasz Françoise", fonts.name.bold)).toBe("Erdos Lukasz Françoise");
  });

  it("renders names with emoji and CJK without crashing in embedded fonts", async () => {
    const bytes = await renderCertificatePdf(
      themed({ fonts: { heading: "prata", name: "crimson", body: "jakarta" } }),
      { ...data, recipientName: "Łukasz 😀 李 Çelik", eventTitle: "Seminar ő 🎉" },
    );
    expect(bytes.byteLength).toBeGreaterThan(1000);
  });
});

describe("text helpers", () => {
  it("strips unsupported marks and replaces unknown characters", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    expect(sanitizeForFont("José Ễ 李", font)).toBe("José E ?");
  });

  it("shrinks long names to fit", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.TimesRomanBold);
    const longName = "Muhammad Rizky Pratama Wijaya Kusuma Hadiningrat Saputra";
    const size = fitFontSize(longName, font, 36, 600, 16);
    expect(size).toBeLessThan(36);
    expect(size).toBeGreaterThanOrEqual(16);
    expect(fitFontSize("Ani", font, 36, 600, 16)).toBe(36);
  });
});
