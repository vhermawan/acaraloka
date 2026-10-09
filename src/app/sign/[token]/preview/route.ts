import { notFound } from "next/navigation";

import { BackgroundUnavailableError, backgroundUnavailableResponse } from "@/server/certificate-background-error";
import {
  getOrCreateCertificateConfig,
  loadCertificateTemplate,
  sampleRenderData,
} from "@/server/certificate-config";
import { renderCertificatePdf } from "@/server/certificate-pdf";
import { canSign, findSignerByToken, loadSignerRenderData } from "@/server/signers";

export async function GET(_request: Request, { params }: RouteContext<"/sign/[token]/preview">) {
  const { token } = await params;
  const signer = await findSignerByToken(token);
  if (!signer || !canSign(signer)) notFound();

  const [config, signers] = await Promise.all([
    getOrCreateCertificateConfig(signer.eventId),
    loadSignerRenderData(signer.eventId),
  ]);
  let pdf: Uint8Array;
  try {
    pdf = await renderCertificatePdf(
      config.layout,
      sampleRenderData(signer.event, signer.event.organizer.orgName, signers),
      { watermark: "PRATINJAU", template: await loadCertificateTemplate(config) },
    );
  } catch (error) {
    if (error instanceof BackgroundUnavailableError) return backgroundUnavailableResponse();
    throw error;
  }

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="pratinjau-sertifikat.pdf"',
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
