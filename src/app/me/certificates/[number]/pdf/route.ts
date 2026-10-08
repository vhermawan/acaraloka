import { notFound } from "next/navigation";

import { getSession } from "@/lib/session";
import { renderCertificatePdf } from "@/server/certificate-pdf";
import { getUserCertificateRenderData } from "@/server/certificates";

export async function GET(_request: Request, { params }: RouteContext<"/me/certificates/[number]/pdf">) {
  const { number } = await params;
  const session = await getSession();
  if (!session || session.user.disabledAt) notFound();

  const certificate = await getUserCertificateRenderData(session.user.id, number);
  if (!certificate) notFound();

  const pdf = await renderCertificatePdf(certificate.layout, certificate.data);
  const filename = `sertifikat-${certificate.data.certificateNumber}.pdf`.replace(/[^A-Za-z0-9._-]/g, "_");

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
