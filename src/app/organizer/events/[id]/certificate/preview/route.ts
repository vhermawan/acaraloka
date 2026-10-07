import { requireEventOwner } from "@/server/authz";
import { getOrCreateCertificateConfig, sampleRenderData } from "@/server/certificate-config";
import { renderCertificatePdf } from "@/server/certificate-pdf";
import { prisma } from "@/server/db";

export async function GET(_request: Request, { params }: RouteContext<"/organizer/events/[id]/certificate/preview">) {
  const { id } = await params;
  const { event, organizer } = await requireEventOwner(id);
  const [config, signers] = await Promise.all([
    getOrCreateCertificateConfig(event.id),
    prisma.signer.findMany({ where: { eventId: event.id }, orderBy: { order: "asc" } }),
  ]);

  const pdf = await renderCertificatePdf(config.layout, sampleRenderData(event, organizer.orgName, signers), {
    watermark: "PRATINJAU",
  });

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="pratinjau-sertifikat.pdf"',
      "Cache-Control": "private, no-store",
    },
  });
}
