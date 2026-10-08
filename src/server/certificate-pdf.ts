import "server-only";

import { PDFDocument, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";

import { APP_NAME, CERTIFICATE_CREDIT } from "@/lib/brand";
import {
  ACCENT_COLORS,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  type CertificateLayout,
  type CertificateTheme,
  type TextAlign,
} from "@/lib/certificate-layout";
import { hasGlyph, loadThemeFonts, type ThemeFonts } from "@/server/certificate-fonts";

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
const NAME_MAX_WIDTH = PAGE_WIDTH * 0.8;
const NAME_MIN_SIZE = 16;
const SIGNATURE_BOX = { width: PAGE_WIDTH * 0.18, height: PAGE_HEIGHT * 0.1 };

function accentColor(theme: CertificateTheme) {
  const hex = ACCENT_COLORS[theme.accent].hex;
  return rgb(
    Number.parseInt(hex.slice(1, 3), 16) / 255,
    Number.parseInt(hex.slice(3, 5), 16) / 255,
    Number.parseInt(hex.slice(5, 7), 16) / 255,
  );
}

const LETTER_FALLBACKS: Record<string, string> = {
  Ł: "L",
  ł: "l",
  Đ: "D",
  đ: "d",
  Ø: "O",
  ø: "o",
  ı: "i",
  ß: "ss",
  Æ: "AE",
  æ: "ae",
  Œ: "OE",
  œ: "oe",
};

function canEncode(font: PDFFont, text: string): boolean {
  const known = [...text].map((char) => hasGlyph(font, char.codePointAt(0) ?? 0));
  if (known.every((value) => value !== null)) return known.every(Boolean);
  try {
    font.encodeText(text);
    return true;
  } catch {
    return false;
  }
}

export function sanitizeForFont(text: string, font: PDFFont): string {
  let output = "";
  for (const char of text) {
    const candidates = [char, char.normalize("NFKD").replace(/\p{M}/gu, ""), LETTER_FALLBACKS[char]];
    const usable = candidates.find((candidate) => candidate && canEncode(font, candidate));
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

function drawBorder(page: PDFPage, theme: CertificateTheme, color: ReturnType<typeof rgb>) {
  if (theme.border === "classic") {
    const outer = 24;
    const inner = 34;
    page.drawRectangle({
      x: outer,
      y: outer,
      width: PAGE_WIDTH - outer * 2,
      height: PAGE_HEIGHT - outer * 2,
      borderColor: color,
      borderWidth: 3,
    });
    page.drawRectangle({
      x: inner,
      y: inner,
      width: PAGE_WIDTH - inner * 2,
      height: PAGE_HEIGHT - inner * 2,
      borderColor: color,
      borderWidth: 0.75,
    });
    return;
  }
  if (theme.border === "thin") {
    const inset = 28;
    page.drawRectangle({
      x: inset,
      y: inset,
      width: PAGE_WIDTH - inset * 2,
      height: PAGE_HEIGHT - inset * 2,
      borderColor: color,
      borderWidth: 1,
    });
    return;
  }
  if (theme.border === "corners") {
    const corners = [
      { x: 24, y: 24, dx: 1, dy: 1 },
      { x: PAGE_WIDTH - 24, y: 24, dx: -1, dy: 1 },
      { x: 24, y: PAGE_HEIGHT - 24, dx: 1, dy: -1 },
      { x: PAGE_WIDTH - 24, y: PAGE_HEIGHT - 24, dx: -1, dy: -1 },
    ];
    for (const { x, y, dx, dy } of corners) {
      page.drawLine({ start: { x, y }, end: { x: x + dx * 72, y }, thickness: 3, color });
      page.drawLine({ start: { x, y }, end: { x, y: y + dy * 72 }, thickness: 3, color });
      const ix = x + dx * 10;
      const iy = y + dy * 10;
      page.drawLine({ start: { x: ix, y: iy }, end: { x: ix + dx * 44, y: iy }, thickness: 0.75, color });
      page.drawLine({ start: { x: ix, y: iy }, end: { x: ix, y: iy + dy * 44 }, thickness: 0.75, color });
      page.drawRectangle({ x: x + dx * 20 - 2, y: y + dy * 20 - 2, width: 4, height: 4, color });
    }
  }
}

function drawHeading(page: PDFPage, fonts: ThemeFonts, color: ReturnType<typeof rgb>) {
  const center = PAGE_WIDTH / 2;
  drawAligned(page, "SERTIFIKAT", { x: center, y: PAGE_HEIGHT * 0.81, size: 38, font: fonts.heading.bold, align: "center", color });
  page.drawLine({
    start: { x: center - 60, y: PAGE_HEIGHT * 0.81 - 26 },
    end: { x: center + 60, y: PAGE_HEIGHT * 0.81 - 26 },
    thickness: 1,
    color,
  });
}

function drawQr(page: PDFPage, url: string, layout: CertificateLayout["verifyQr"], font: PDFFont) {
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
    font,
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
  pdf.setProducer(APP_NAME);
  pdf.setCreator(APP_NAME);
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const fonts = await loadThemeFonts(pdf, layout.theme);
  const accent = accentColor(layout.theme);

  drawBorder(page, layout.theme, accent);
  drawHeading(page, fonts, accent);

  const name = layout.recipientName;
  const namePoint = toPoint(name.x, name.y);
  const nameText = sanitizeForFont(data.recipientName, fonts.name.bold);
  const nameSize = fitFontSize(nameText, fonts.name.bold, name.fontSize, NAME_MAX_WIDTH, NAME_MIN_SIZE);
  drawAligned(page, "Diberikan kepada", {
    x: namePoint.x,
    y: namePoint.y + nameSize * 0.9 + 6,
    size: 12,
    font: fonts.heading.regular,
    align: name.align,
    color: MUTED,
  });
  drawAligned(page, nameText, { x: namePoint.x, y: namePoint.y, size: nameSize, font: fonts.name.bold, align: name.align });

  const title = layout.eventTitle;
  const titlePoint = toPoint(title.x, title.y);
  const titleSize = fitFontSize(
    sanitizeForFont(data.eventTitle, fonts.body.bold),
    fonts.body.bold,
    title.fontSize,
    PAGE_WIDTH * 0.85,
    9,
  );
  drawAligned(page, "atas partisipasinya sebagai peserta dalam", {
    x: titlePoint.x,
    y: titlePoint.y + titleSize + 6,
    size: 11,
    font: fonts.heading.regular,
    align: title.align,
    color: MUTED,
  });
  drawAligned(page, data.eventTitle, { x: titlePoint.x, y: titlePoint.y, size: titleSize, font: fonts.body.bold, align: title.align });

  const date = layout.eventDate;
  const datePoint = toPoint(date.x, date.y);
  drawAligned(page, `${data.eventDate} · ${data.organizerName}`, {
    x: datePoint.x,
    y: datePoint.y,
    size: date.fontSize,
    font: fonts.body.regular,
    align: date.align,
    color: MUTED,
  });

  const number = layout.certificateNumber;
  const numberPoint = toPoint(number.x, number.y);
  drawAligned(page, `No. ${data.certificateNumber}`, {
    x: numberPoint.x,
    y: numberPoint.y,
    size: number.fontSize,
    font: fonts.body.regular,
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
      font: fonts.body.bold,
      align: "center",
    });
    drawAligned(page, signer.title, {
      x: point.x,
      y: lineY - block.fontSize * 2 - 6,
      size: Math.max(8, block.fontSize - 2),
      font: fonts.body.regular,
      align: "center",
      color: MUTED,
    });
  }

  drawQr(page, data.verifyUrl, layout.verifyQr, fonts.body.regular);

  drawAligned(page, CERTIFICATE_CREDIT, {
    x: PAGE_WIDTH / 2,
    y: 46,
    size: 8,
    font: fonts.body.regular,
    align: "center",
    color: MUTED,
  });

  if (options.watermark) {
    const size = 72;
    const width = fonts.body.bold.widthOfTextAtSize(options.watermark, size);
    page.drawText(options.watermark, {
      x: PAGE_WIDTH / 2 - (width / 2) * Math.cos(Math.PI / 9),
      y: PAGE_HEIGHT / 2 - (width / 2) * Math.sin(Math.PI / 9),
      size,
      font: fonts.body.bold,
      color: rgb(0.85, 0.2, 0.2),
      opacity: 0.18,
      rotate: degrees(20),
    });
  }

  return pdf.save();
}
