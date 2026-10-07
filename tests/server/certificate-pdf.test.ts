import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { defaultCertificateLayout } from "@/lib/certificate-layout";
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
  verifyUrl: "https://hadirly.example/v/EI-2610-0001-K7Q3XM",
  signers: [
    { name: "Dr. Budi Santoso", title: "Ketua Pelaksana", signaturePng: PNG_1X1 },
    { name: "Ayu Lestari", title: "Narasumber", signaturePng: null },
  ],
};

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
