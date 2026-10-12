import { describe, expect, it } from "vitest";

import { toCertificateLayout } from "@/lib/ai/design-brief";
import { LAYOUT_PRESETS, LAYOUT_PRESET_KEYS, type Rect } from "@/lib/ai/layout-presets";
import { presetBriefFor } from "@/lib/ai/style-presets";
import { STYLE_KEYS } from "@/lib/ai/styles";
import { PAGE_HEIGHT, PAGE_WIDTH, defaultCertificateLayout, type CertificateLayout } from "@/lib/certificate-layout";

type Box = { label: string; x1: number; y1: number; x2: number; y2: number };

const W = PAGE_WIDTH;
const H = PAGE_HEIGHT;

function textBox(label: string, text: string, size: number, x: number, y: number, align: string, factor: number): Box {
  const width = (text.length * size * factor) / W;
  const height = size / H;
  const left = align === "center" ? x - width / 2 : align === "right" ? x - width : x;
  return { label, x1: left, y1: y - height / 2, x2: left + width, y2: y + height / 2 };
}

function layoutBoxes(layout: CertificateLayout, signerCount: number): { text: Box[]; qr: Box } {
  const boxes: Box[] = [];
  const { heading, recipientName: name, eventTitle: title, eventDate: date, certificateNumber: number } = layout;
  boxes.push(textBox("heading", "SERTIFIKAT", heading.fontSize, heading.x, heading.y, heading.align, 0.8));
  boxes.push(textBox("number", "No. CERT/2026/0001", number.fontSize, number.x, number.y, number.align, 0.6));

  const namePrefixY = name.y - (name.fontSize * 0.9 + 6) / H;
  boxes.push(textBox("recipientPrefix", "Diberikan kepada", 12, name.x, namePrefixY, name.align, 0.55));
  boxes.push(textBox("name", "Muhammad Rizky Ramadhan", name.fontSize, name.x, name.y, name.align, 0.6));

  const titlePrefixY = title.y - (title.fontSize + 6) / H;
  boxes.push(textBox("eventPrefix", "atas partisipasinya sebagai peserta dalam", 11, title.x, titlePrefixY, title.align, 0.5));
  boxes.push(textBox("title", "Seminar Kesehatan Kampus Nasional 2026", title.fontSize, title.x, title.y, title.align, 0.6));
  boxes.push(textBox("date", "12 Oktober 2026 · Panitia Acaraloka", date.fontSize, date.x, date.y, date.align, 0.55));

  for (const [index, signer] of layout.signers.slice(0, signerCount).entries()) {
    boxes.push({
      label: `signer${index}`,
      x1: signer.x - 0.09,
      x2: signer.x + 0.09,
      y1: signer.y - 0.1,
      y2: signer.y + (signer.fontSize * 2 + 10) / H,
    });
  }

  const half = layout.verifyQr.size / 2 + 4 / W;
  const qrHeightHalf = (layout.verifyQr.size * W) / 2 / H + 4 / H;
  const qr: Box = {
    label: "qr",
    x1: layout.verifyQr.x - half,
    x2: layout.verifyQr.x + half,
    y1: layout.verifyQr.y - qrHeightHalf,
    y2: layout.verifyQr.y + qrHeightHalf + 20 / H,
  };
  return { text: boxes, qr };
}

function overlaps(a: { x1: number; y1: number; x2: number; y2: number }, b: typeof a) {
  return a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;
}

function asBox(label: string, rect: Rect): Box {
  return { label, x1: rect.x, y1: rect.y, x2: rect.x + rect.width, y2: rect.y + rect.height };
}

const CREDIT: Box = { label: "credit", x1: 0.3, x2: 0.7, y1: 1 - 54 / H, y2: 1 - 38 / H };

describe("layout presets", () => {
  it.each(LAYOUT_PRESET_KEYS)("%s keeps the logo slot clear of every element for 1-3 signers", (key) => {
    const preset = LAYOUT_PRESETS[key];
    const brief = { ...presetBriefFor("minimal", null), layoutPreset: key };
    const logo = asBox("logo", preset.logoSlot);

    expect(preset.logoSlot.y + preset.logoSlot.height).toBeLessThanOrEqual(0.12 + 0.04);
    expect(preset.logoSlot.x + preset.logoSlot.width / 2).toBeCloseTo(0.5, 5);

    for (const count of [1, 2, 3]) {
      const layout = toCertificateLayout(brief, defaultCertificateLayout(count), count);
      const { text, qr } = layoutBoxes(layout, count);
      for (const box of [...text, qr, CREDIT]) {
        expect(overlaps(logo, box), `${key}/${count}: ${box.label} overlaps logo slot`).toBe(false);
      }
    }
  });

  it.each(LAYOUT_PRESET_KEYS)("%s has no text collisions for 1-3 signers", (key) => {
    const brief = { ...presetBriefFor("minimal", null), layoutPreset: key };
    for (const count of [1, 2, 3]) {
      const layout = toCertificateLayout(brief, defaultCertificateLayout(count), count);
      const { text, qr } = layoutBoxes(layout, count);
      const all = [...text, qr, CREDIT];
      for (let i = 0; i < all.length; i += 1) {
        for (let j = i + 1; j < all.length; j += 1) {
          const a = all[i]!;
          const b = all[j]!;
          expect(overlaps(a, b), `${key}/${count}: ${a.label} collides with ${b.label}`).toBe(false);
        }
      }
    }
  });

  it.each(LAYOUT_PRESET_KEYS)("%s keeps text inside the safe area", (key) => {
    const preset = LAYOUT_PRESETS[key];
    const brief = { ...presetBriefFor("minimal", null), layoutPreset: key };
    for (const count of [1, 2, 3]) {
      const layout = toCertificateLayout(brief, defaultCertificateLayout(count), count);
      for (const box of layoutBoxes(layout, count).text) {
        expect(box.x1, `${key}/${count}: ${box.label} left`).toBeGreaterThanOrEqual(preset.safeArea.x);
        expect(box.x2, `${key}/${count}: ${box.label} right`).toBeLessThanOrEqual(preset.safeArea.x + preset.safeArea.width);
        expect(box.y1, `${key}/${count}: ${box.label} top`).toBeGreaterThanOrEqual(preset.safeArea.y);
        expect(box.y2, `${key}/${count}: ${box.label} bottom`).toBeLessThanOrEqual(preset.safeArea.y + preset.safeArea.height);
      }
    }
  });

  it("covers every style with a preset that exists", () => {
    for (const style of STYLE_KEYS) {
      expect(LAYOUT_PRESET_KEYS).toContain(presetBriefFor(style, null).layoutPreset);
    }
  });
});
