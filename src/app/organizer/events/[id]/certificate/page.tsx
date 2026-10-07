import type { Metadata } from "next";

import { CertificateLayoutEditor } from "@/components/certificate/certificate-layout-editor";
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
      select: { name: true, title: true },
    }),
  ]);

  return (
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
        signers={signers}
        locked={config.lockedAt !== null}
      />
    </div>
  );
}
