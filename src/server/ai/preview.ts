import "server-only";

import { aiDesignBriefSchema, toCertificateLayout } from "@/lib/ai/design-brief";
import { LAYOUT_PRESETS } from "@/lib/ai/layout-presets";
import { BACKGROUND_MAX_BYTES } from "@/lib/certificate-background";
import { PAGE_HEIGHT, PAGE_WIDTH, type CertificateLayout } from "@/lib/certificate-layout";
import { compositeLogo } from "@/server/ai/image-ops";
import { sampleRenderData } from "@/server/certificate-config";
import { renderCertificatePdf } from "@/server/certificate-pdf";
import { AI_BUCKET, downloadObject } from "@/server/storage";

export const PREVIEW_RECIPIENT_NAME = "Rina Pratama";

export class AiPreviewUnavailableError extends Error {
  constructor() {
    super("AI preview is unavailable");
    this.name = "AiPreviewUnavailableError";
  }
}

export type AiPreviewInput = {
  eventId: string;
  event: { title: string; startAt: Date; timezone: string };
  organizerName: string;
  generation: { brief: unknown; resultPaths: string[] };
  currentLayout: CertificateLayout;
  signers: { name: string; title: string; signaturePng?: Uint8Array | null }[];
  logoPath: string | null;
};

export type AiPreviewDeps = {
  download: (path: string) => Promise<Uint8Array>;
};

export async function renderAiPreview(
  input: AiPreviewInput,
  deps: AiPreviewDeps = { download: (path) => downloadObject(AI_BUCKET, path) },
): Promise<Uint8Array> {
  const brief = aiDesignBriefSchema.safeParse(input.generation.brief);
  const backgroundPath = input.generation.resultPaths[0];
  if (!brief.success || !backgroundPath) throw new AiPreviewUnavailableError();

  const downloaded = await Promise.all([
    deps.download(backgroundPath),
    input.logoPath ? deps.download(input.logoPath) : Promise.resolve(null),
  ]).catch(() => {
    throw new AiPreviewUnavailableError();
  });
  const [original, logo] = downloaded;

  const slot = LAYOUT_PRESETS[brief.data.layoutPreset].logoSlot;
  const bytes = logo ? await compositeLogo(original, logo, slot, BACKGROUND_MAX_BYTES) : original;
  const signerCount = Math.max(1, input.signers.length);
  const layout = toCertificateLayout(brief.data, input.currentLayout, signerCount);

  return renderCertificatePdf(
    layout,
    sampleRenderData(input.event, input.organizerName, input.signers, { recipientName: PREVIEW_RECIPIENT_NAME }),
    {
      watermark: "PRATINJAU",
      template: {
        pageWidth: PAGE_WIDTH,
        pageHeight: PAGE_HEIGHT,
        background: { bytes, path: `events/${input.eventId}/${"0".repeat(16)}.jpg` },
      },
    },
  );
}
