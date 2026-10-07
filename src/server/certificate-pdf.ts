import "server-only";

import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";

import {
  PAGE_HEIGHT,
  PAGE_WIDTH,
  type CertificateLayout,
  type TextAlign,
} from "@/lib/certificate-layout";

export type CertificateRenderData = {
  recipientName: string;
  certificateNumber: string;
  eventTitle: string;
  eventDate: string;
  organizerName: string;
  verifyUrl: string;
  signers: { name: string; title: string; signaturePng: Uint8Array | null }[];
};

const INK = rgb(0.11, 0.11, 0.12);
const MUTED = rgb(0.38, 0.38, 0.4);
const ACCENT = rgb(15 / 255, 118 / 255, 110 / 255);
const NAME_MAX_WIDTH = PAGE_WIDTH * 0.8;
const NAME_MIN_SIZE = 16;
const SIGNATURE_BOX = { width: PAGE_WIDTH * 0.18, height: PAGE_HEIGHT * 0.1 };

type Fonts = { title: PDFFont; serif: PDFFont; sans: PDFFont; sansBold: PDFFont };

export function sanitizeForFont(text: string, font: PDFFont): string {
  let output = "";
  for (const char of text) {
    const candidates = [char, char.normalize("NFKD").replace(/\p{M}/gu, "")];
    const usable = candidates.find((candidate) => {
      if (!candidate) return false;
      try {
        font.encodeText(candidate);
        return true;
      } catch {
        return false;
      }
    });
    output += usable ?? "?";
  }
  return output;
}

export function fitFontSize(text: string, font: PDFFont, size: number, maxWidth: number, minSize: number): number {
  let current = size;
  while (current > minSize && font.widthOfTextAtSize(text, current) > maxWidth) current -= 1;
  return current;
}

function drawAligned(
  page: PDFPage,
  rawText: string,
  options: { x: number; y: number; size: number; font: PDFFont; align: TextAlign; color?: ReturnType<typeof rgb> },
) {
  const text = sanitizeForFont(rawText, options.font);
  const width = options.font.widthOfTextAtSize(text, options.size);
  const left =
    options.align === "center" ? options.x - width / 2 : options.align === "right" ? options.x - width : options.x;
  page.drawText(text, {
    x: left,
    y: options.y - options.size * 0.35,
    size: options.size,
    font: options.font,
    color: options.color ?? INK,
  });
}

function toPoint(x: number, y: number) {
  return { x: x * PAGE_WIDTH, y: (1 - y) * PAGE_HEIGHT };
}

function drawClassicTemplate(page: PDFPage, fonts: Fonts) {
  const outer = 24;
  const inner = 34;
  page.drawRectangle({
    x: outer,
    y: outer,
    width: PAGE_WIDTH - outer * 2,
    height: PAGE_HEIGHT - outer * 2,
    borderColor: ACCENT,
    borderWidth: 3,
  });
  page.drawRectangle({
    x: inner,
    y: inner,
    width: PAGE_WIDTH - inner * 2,
    height: PAGE_HEIGHT - inner * 2,
    borderColor: ACCENT,
    borderWidth: 0.75,
  });
  const center = PAGE_WIDTH / 2;
  drawAligned(page, "SERTIFIKAT", { x: center, y: PAGE_HEIGHT * 0.81, size: 38, font: fonts.title, align: "center", color: ACCENT });
  page.drawLine({
    start: { x: center - 60, y: PAGE_HEIGHT * 0.81 - 26 },
    end: { x: center + 60, y: PAGE_HEIGHT * 0.81 - 26 },
    thickness: 1,
    color: ACCENT,
  });
}

function drawQr(page: PDFPage, url: string, layout: CertificateLayout["verifyQr"], fonts: Fonts) {
  const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
  const count = qr.modules.size;
  const size = layout.size * PAGE_WIDTH;
  const cell = size / count;
  const center = toPoint(layout.x, layout.y);
  const left = center.x - size / 2;
  const top = center.y + size / 2;
  page.drawRectangle({ x: left - 4, y: top - size - 4, width: size + 8, height: size + 8, color: rgb(1, 1, 1) });
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (!qr.modules.get(row, col)) continue;
      page.drawRectangle({ x: left + col * cell, y: top - (row + 1) * cell, width: cell, height: cell, color: INK });
    }
  }
  drawAligned(page, "Pindai untuk verifikasi", {
    x: center.x,
    y: top - size - 12,
    size: 7,
    font: fonts.sans,
    align: "center",
    color: MUTED,
  });
}

export async function renderCertificatePdf(
  layout: CertificateLayout,
  data: CertificateRenderData,
  options: { watermark?: string } = {},
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Sertifikat ${data.recipientName}`);
  pdf.setProducer("Hadirly");
  pdf.setCreator("Hadirly");
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const fonts: Fonts = {
    title: await pdf.embedFont(StandardFonts.TimesRomanBold),
    serif: await pdf.embedFont(StandardFonts.TimesRoman),
    sans: await pdf.embedFont(StandardFonts.Helvetica),
    sansBold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };

  drawClassicTemplate(page, fonts);

  const name = layout.recipientName;
  const namePoint = toPoint(name.x, name.y);
  const nameText = sanitizeForFont(data.recipientName, fonts.title);
  const nameSize = fitFontSize(nameText, fonts.title, name.fontSize, NAME_MAX_WIDTH, NAME_MIN_SIZE);
  drawAligned(page, "Diberikan kepada", {
    x: namePoint.x,
    y: namePoint.y + nameSize * 0.9 + 6,
    size: 12,
    font: fonts.serif,
    align: name.align,
    color: MUTED,
  });
  drawAligned(page, nameText, { x: namePoint.x, y: namePoint.y, size: nameSize, font: fonts.title, align: name.align });

  const title = layout.eventTitle;
  const titlePoint = toPoint(title.x, title.y);
  const titleSize = fitFontSize(
    sanitizeForFont(data.eventTitle, fonts.sansBold),
    fonts.sansBold,
    title.fontSize,
    PAGE_WIDTH * 0.85,
    9,
  );
  drawAligned(page, "atas partisipasinya sebagai peserta dalam", {
    x: titlePoint.x,
    y: titlePoint.y + titleSize + 6,
    size: 11,
    font: fonts.serif,
    align: title.align,
    color: MUTED,
  });
  drawAligned(page, data.eventTitle, { x: titlePoint.x, y: titlePoint.y, size: titleSize, font: fonts.sansBold, align: title.align });

  const date = layout.eventDate;
  const datePoint = toPoint(date.x, date.y);
  drawAligned(page, `${data.eventDate} · ${data.organizerName}`, {
    x: datePoint.x,
    y: datePoint.y,
    size: date.fontSize,
    font: fonts.sans,
    align: date.align,
    color: MUTED,
  });

  const number = layout.certificateNumber;
  const numberPoint = toPoint(number.x, number.y);
  drawAligned(page, `No. ${data.certificateNumber}`, {
    x: numberPoint.x,
    y: numberPoint.y,
    size: number.fontSize,
    font: fonts.sans,
    align: number.align,
    color: MUTED,
  });

  for (const [index, signer] of data.signers.slice(0, layout.signers.length).entries()) {
    const block = layout.signers[index];
    const point = toPoint(block.x, block.y);
    const lineY = point.y;
    if (signer.signaturePng) {
      const image = await pdf.embedPng(signer.signaturePng);
      const scale = Math.min(SIGNATURE_BOX.width / image.width, SIGNATURE_BOX.height / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      page.drawImage(image, { x: point.x - width / 2, y: lineY + 2, width, height });
    }
    page.drawLine({
      start: { x: point.x - SIGNATURE_BOX.width / 2, y: lineY },
      end: { x: point.x + SIGNATURE_BOX.width / 2, y: lineY },
      thickness: 0.75,
      color: MUTED,
    });
    drawAligned(page, signer.name, {
      x: point.x,
      y: lineY - block.fontSize - 2,
      size: block.fontSize,
      font: fonts.sansBold,
      align: "center",
    });
    drawAligned(page, signer.title, {
      x: point.x,
      y: lineY - block.fontSize * 2 - 6,
      size: Math.max(8, block.fontSize - 2),
      font: fonts.sans,
      align: "center",
      color: MUTED,
    });
  }

  drawQr(page, data.verifyUrl, layout.verifyQr, fonts);

  drawAligned(page, "Diterbitkan via Hadirly", {
    x: PAGE_WIDTH / 2,
    y: 46,
    size: 8,
    font: fonts.sans,
    align: "center",
    color: MUTED,
  });

  if (options.watermark) {
    const size = 72;
    const width = fonts.sansBold.widthOfTextAtSize(options.watermark, size);
    page.drawText(options.watermark, {
      x: PAGE_WIDTH / 2 - (width / 2) * Math.cos(Math.PI / 9),
      y: PAGE_HEIGHT / 2 - (width / 2) * Math.sin(Math.PI / 9),
      size,
      font: fonts.sansBold,
      color: rgb(0.85, 0.2, 0.2),
      opacity: 0.18,
      rotate: degrees(20),
    });
  }

  return pdf.save();
}
