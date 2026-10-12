import { notFound } from "next/navigation";

import { AI_UNAVAILABLE_CODE, AI_UNAVAILABLE_MESSAGE } from "@/lib/ai-config";
import { aiStatusPayload } from "@/lib/ai/status";
import { getAiAccess } from "@/server/ai-access";
import { sweepStaleGenerations } from "@/server/ai-quota";
import { requireEventOwner } from "@/server/authz";
import { prisma } from "@/server/db";

const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(
  _request: Request,
  { params }: RouteContext<"/organizer/events/[id]/certificate/ai/[genId]/status">,
) {
  const { id, genId } = await params;
  const { user, event } = await requireEventOwner(id);
  const access = await getAiAccess(user, { eventId: event.id, kind: "CERTIFICATE" });
  if (access.status === "HIDDEN") {
    return Response.json({ code: AI_UNAVAILABLE_CODE, message: AI_UNAVAILABLE_MESSAGE }, { status: 404, headers: NO_STORE });
  }

  await sweepStaleGenerations(prisma);
  const generation = await prisma.aiGeneration.findFirst({
    where: { id: genId, eventId: event.id, kind: "CERTIFICATE" },
    select: { status: true, phase: true, failureCode: true },
  });
  if (!generation) notFound();

  return Response.json(aiStatusPayload(generation), { headers: NO_STORE });
}
