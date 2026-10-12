import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import type { AiDesignBrief } from "@/lib/ai/design-brief";
import { presetBriefFor } from "@/lib/ai/style-presets";
import { defaultCertificateLayout } from "@/lib/certificate-layout";

vi.mock("@/server/storage", () => ({ AI_BUCKET: "ai-generations", downloadObject: vi.fn() }));
vi.mock("@/server/db", () => ({ prisma: {} }));
vi.mock("@/server/storage-cleanup", () => ({ removeObjectsQuietly: vi.fn(), reportCleanupFailure: vi.fn() }));

const { AiPreviewUnavailableError, PREVIEW_RECIPIENT_NAME, renderAiPreview } = await import("@/server/ai/preview");

function hex(text: string) {
  return [...text].map((char) => char.charCodeAt(0).toString(16).padStart(2, "0")).join("").toUpperCase();
}

async function pageContent(bytes: Uint8Array): Promise<string> {
  const pdf = await PDFDocument.load(bytes);
  const contents = pdf.getPage(0).node.Contents();
  const refs = contents instanceof PDFArray ? contents.asArray() : [];
  return refs
    .map((ref) => {
      const stream = pdf.context.lookup(ref);
      return stream instanceof PDFRawStream ? Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1") : "";
    })
    .join("\n")
    .toUpperCase();
}

const brief: AiDesignBrief = {
  ...presetBriefFor("minimal", null),
  fonts: { heading: "times", name: "times", body: "helvetica" },
  palette: { primary: "#0f766e", secondary: "#6d28d9", background: "#ffffff", text: "#ffffff" },
};

async function background() {
  return new Uint8Array(
    await sharp({ create: { width: 2480, height: 1754, channels: 3, background: "#12355b" } }).jpeg().toBuffer(),
  );
}

async function logo() {
  return new Uint8Array(await sharp({ create: { width: 300, height: 300, channels: 3, background: "#ff0000" } }).png().toBuffer());
}

const baseInput = {
  eventId: "ev1",
  event: { title: "Seminar Kesehatan", startAt: new Date("2026-10-12T02:00:00Z"), timezone: "Asia/Jakarta" },
  organizerName: "HIMA Teknik",
  generation: { brief, resultPaths: ["events/ev1/cert-g1.jpg", "events/ev1/cert-g1-thumb.jpg"] },
  currentLayout: defaultCertificateLayout(1),
  signers: [{ name: "Dr. Budi Santoso", title: "Ketua Panitia", signaturePng: null }],
  logoPath: null as string | null,
};

describe("renderAiPreview", () => {
  it("renders a one page A4 PDF with the sample name, watermark and the brief ink color", async () => {
    const download = vi.fn(async () => background());
    const pdf = await renderAiPreview(baseInput, { download });
    expect(download).toHaveBeenCalledTimes(1);
    expect(download).toHaveBeenCalledWith("events/ev1/cert-g1.jpg");

    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBe(1);
    expect(Math.round(doc.getPage(0).getSize().width)).toBe(842);

    const content = await pageContent(pdf);
    expect(PREVIEW_RECIPIENT_NAME).toBe("Rina Pratama");
    expect(content).toContain(hex("Rina Pratama"));
    expect(content).toContain(hex("PRATINJAU"));
    expect(content).toContain(hex("Seminar Kesehatan"));
    expect(content).toContain(hex("Dr. Budi Santoso"));
    expect(content).toContain("1 1 1 RG");
  });

  it("composites the chosen logo into the background without sending it anywhere else", async () => {
    const original = await background();
    const downloads: string[] = [];
    const download = async (path: string) => {
      downloads.push(path);
      return path.includes("logo-") ? logo() : original;
    };
    const withoutLogo = await renderAiPreview(baseInput, { download: async () => original });
    const withLogo = await renderAiPreview(
      { ...baseInput, logoPath: "events/ev1/logo-0123456789abcdef.png" },
      { download },
    );
    expect(downloads).toEqual(["events/ev1/cert-g1.jpg", "events/ev1/logo-0123456789abcdef.png"]);
    expect(withLogo.byteLength).not.toBe(withoutLogo.byteLength);
  });

  it.each([
    ["an invalid brief", { brief: { nope: true }, resultPaths: ["events/ev1/cert-g1.jpg"] }],
    ["a missing result file path", { brief, resultPaths: [] }],
  ])("is unavailable for %s", async (_name, generation) => {
    await expect(renderAiPreview({ ...baseInput, generation }, { download: async () => background() })).rejects.toBeInstanceOf(
      AiPreviewUnavailableError,
    );
  });

  it("is unavailable when the stored files cannot be downloaded", async () => {
    await expect(
      renderAiPreview(baseInput, {
        download: async () => {
          throw new Error("404");
        },
      }),
    ).rejects.toBeInstanceOf(AiPreviewUnavailableError);
  });

  it("keeps label texts and heading visibility from the current layout", async () => {
    const layout = defaultCertificateLayout(1);
    layout.labels.recipientPrefix.text = "Dianugerahkan kepada";
    layout.heading.visible = true;
    layout.labels.heading.text = "PIAGAM";
    const pdf = await renderAiPreview({ ...baseInput, currentLayout: layout }, { download: async () => background() });
    const content = await pageContent(pdf);
    expect(content).toContain(hex("Dianugerahkan kepada"));
    expect(content).toContain(hex("PIAGAM"));
  });
});
