import { notFound } from "next/navigation";

import { backgroundFormat } from "@/lib/certificate-background";
import { requireEventOwner } from "@/server/authz";
import { getOrCreateCertificateConfig } from "@/server/certificate-config";
import { CERTIFICATE_BACKGROUND_BUCKET, downloadObject } from "@/server/storage";

export async function GET(_request: Request, { params }: RouteContext<"/organizer/events/[id]/certificate/background">) {
  const { id } = await params;
  const { event } = await requireEventOwner(id);
  const config = await getOrCreateCertificateConfig(event.id);
  if (config.templateSource !== "UPLOAD" || !config.backgroundPath) notFound();

  const bytes = await downloadObject(CERTIFICATE_BACKGROUND_BUCKET, config.backgroundPath);
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": backgroundFormat(config.backgroundPath) === "png" ? "image/png" : "image/jpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
