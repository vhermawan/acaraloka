import { notFound } from "next/navigation";

import { AI_UNAVAILABLE_CODE, AI_UNAVAILABLE_MESSAGE } from "@/lib/ai-config";
import { isAiLogoPathFor } from "@/lib/ai/paths";
import { getAiAccess } from "@/server/ai-access";
import { AiPreviewUnavailableError, renderAiPreview } from "@/server/ai/preview";
import { requireEventOwner } from "@/server/authz";
import { getOrCreateCertificateConfig } from "@/server/certificate-config";
import { prisma } from "@/server/db";
import { loadSignerRenderData } from "@/server/signers";

const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(
  request: Request,
  { params }: RouteContext<"/organizer/events/[id]/certificate/ai/[genId]/preview">,
) {
  const { id, genId } = await params;
  const { user, event, organizer } = await requireEventOwner(id);
  const access = await getAiAccess(user, { eventId: event.id, kind: "CERTIFICATE" });
  if (access.status === "HIDDEN") {
    return Response.json({ code: AI_UNAVAILABLE_CODE, message: AI_UNAVAILABLE_MESSAGE }, { status: 404, headers: NO_STORE });
  }

  const logo = new URL(request.url).searchParams.get("logo");
  const logoPath = logo && logo !== "none" ? logo : null;
  if (logoPath && !isAiLogoPathFor(event.id, logoPath)) notFound();

  const generation = await prisma.aiGeneration.findFirst({
    where: {
      id: genId,
      eventId: event.id,
      kind: "CERTIFICATE",
      status: "SUCCEEDED",
      reportedAt: null,
      purgedAt: null,
    },
    select: { brief: true, resultPaths: true },
  });
  if (!generation) notFound();

  const [config, signers] = await Promise.all([getOrCreateCertificateConfig(event.id), loadSignerRenderData(event.id)]);

  let pdf: Uint8Array;
  try {
    pdf = await renderAiPreview({
      eventId: event.id,
      event,
      organizerName: organizer.orgName,
      generation,
      currentLayout: config.layout,
      signers,
      logoPath,
    });
  } catch (error) {
    if (error instanceof AiPreviewUnavailableError) notFound();
    throw error;
  }

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="pratinjau-sertifikat-ai.pdf"',
      ...NO_STORE,
    },
  });
}
