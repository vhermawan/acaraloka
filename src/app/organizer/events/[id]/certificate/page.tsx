import type { Metadata } from "next";

import { CertificateLayoutEditor } from "@/components/certificate/certificate-layout-editor";
import { IssuedList } from "@/components/certificate/issued-list";
import { IssuePanel } from "@/components/certificate/issue-panel";
import { SignerPanel } from "@/components/certificate/signer-panel";
import { issueBlocker } from "@/lib/certificate-issue";
import { signerLinkState } from "@/lib/validation/signer";
import { requireEventOwner } from "@/server/authz";
import { getOrCreateCertificateConfig } from "@/server/certificate-config";
import { certificateIssueStats, listEventCertificates } from "@/server/certificates";
import { prisma } from "@/server/db";

export const metadata: Metadata = {
  title: "Sertifikat",
};

export default async function CertificatePage({ params }: PageProps<"/organizer/events/[id]/certificate">) {
  const { id } = await params;
  const { event } = await requireEventOwner(id);
  const [config, signers, stats, certificates] = await Promise.all([
    getOrCreateCertificateConfig(event.id),
    prisma.signer.findMany({
      where: { eventId: event.id },
      orderBy: { order: "asc" },
    }),
    certificateIssueStats(event.id),
    listEventCertificates(event.id),
  ]);

  const signerRows = signers.map((signer) => ({
    id: signer.id,
    name: signer.name,
    title: signer.title,
    email: signer.email,
    state: signerLinkState(signer),
    declineReason: signer.declineReason,
  }));

  const blocker = issueBlocker(
    {
      eventStatus: event.status,
      startAt: event.startAt,
      lockedAt: config.lockedAt,
      signerStatuses: signers.map((signer) => signer.status),
    },
    new Date(),
  );

  return (
    <div className="flex flex-col gap-12">
      <SignerPanel
        eventId={event.id}
        signers={signerRows}
        locked={config.lockedAt !== null}
        issued={config.firstIssuedAt !== null}
        closed={event.status === "CANCELLED" || event.status === "DISABLED"}
      />
      <IssuePanel
        eventId={event.id}
        blocker={blocker}
        issued={stats.issued}
        waiting={stats.waiting}
        everIssued={config.firstIssuedAt !== null}
      />
      {certificates.length > 0 ? <IssuedList eventId={event.id} certificates={certificates} /> : null}
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
