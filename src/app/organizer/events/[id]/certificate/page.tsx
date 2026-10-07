import type { Metadata } from "next";

import { CertificateLayoutEditor } from "@/components/certificate/certificate-layout-editor";
import { SignerPanel } from "@/components/certificate/signer-panel";
import { signerLinkState } from "@/lib/validation/signer";
import { requireEventOwner } from "@/server/authz";
import { getOrCreateCertificateConfig } from "@/server/certificate-config";
import { prisma } from "@/server/db";

export const metadata: Metadata = {
  title: "Sertifikat | event-in",
};

export default async function CertificatePage({ params }: PageProps<"/organizer/events/[id]/certificate">) {
  const { id } = await params;
  const { event } = await requireEventOwner(id);
  const [config, signers] = await Promise.all([
    getOrCreateCertificateConfig(event.id),
    prisma.signer.findMany({
      where: { eventId: event.id },
      orderBy: { order: "asc" },
    }),
  ]);

  const signerRows = signers.map((signer) => ({
    id: signer.id,
    name: signer.name,
    title: signer.title,
    email: signer.email,
    state: signerLinkState(signer),
    declineReason: signer.declineReason,
  }));

  return (
    <div className="flex flex-col gap-12">
      <SignerPanel
        eventId={event.id}
        signers={signerRows}
        locked={config.lockedAt !== null}
        issued={config.firstIssuedAt !== null}
        closed={event.status === "CANCELLED" || event.status === "DISABLED"}
      />
      <div className="flex flex-col gap-6">
        <div className="flex max-w-prose flex-col gap-1">
          <h2 className="text-lg font-semibold">Posisi elemen sertifikat</h2>
          <p className="text-sm text-muted-foreground">
            Pilih elemen, geser dengan tombol panah, lalu simpan. Sertifikat hanya terbit untuk peserta yang sudah check-in.
          </p>
        </div>
        <CertificateLayoutEditor
          eventId={event.id}
          initialLayout={config.layout}
          signers={signers.map((signer) => ({ name: signer.name, title: signer.title }))}
          locked={config.lockedAt !== null}
        />
      </div>
    </div>
  );
}
