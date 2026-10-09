import { requireEventOwner } from "@/server/authz";
import { BackgroundUnavailableError, backgroundUnavailableResponse } from "@/server/certificate-background-error";
import {
  getOrCreateCertificateConfig,
  loadCertificateTemplate,
  sampleRenderData,
} from "@/server/certificate-config";
import { renderCertificatePdf } from "@/server/certificate-pdf";
import { loadSignerRenderData } from "@/server/signers";

export async function GET(_request: Request, { params }: RouteContext<"/organizer/events/[id]/certificate/preview">) {
  const { id } = await params;
  const { event, organizer } = await requireEventOwner(id);
  const [config, signers] = await Promise.all([
    getOrCreateCertificateConfig(event.id),
    loadSignerRenderData(event.id),
  ]);

  let pdf: Uint8Array;
  try {
    pdf = await renderCertificatePdf(config.layout, sampleRenderData(event, organizer.orgName, signers), {
      watermark: "PRATINJAU",
      template: await loadCertificateTemplate(config),
    });
  } catch (error) {
    if (error instanceof BackgroundUnavailableError) return backgroundUnavailableResponse();
    throw error;
  }

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="pratinjau-sertifikat.pdf"',
      "Cache-Control": "private, no-store",
    },
  });
}
