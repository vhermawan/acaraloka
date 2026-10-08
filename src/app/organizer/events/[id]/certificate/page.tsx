import type { Metadata } from "next";
import { Lock } from "lucide-react";

import { CertificateLayoutEditor } from "@/components/certificate/certificate-layout-editor";
import { CertificateStep } from "@/components/certificate/certificate-step";
import { IssuedList } from "@/components/certificate/issued-list";
import { IssuePanel } from "@/components/certificate/issue-panel";
import { SignerPanel } from "@/components/certificate/signer-panel";
import { UnlockDesignButton } from "@/components/certificate/unlock-design-button";
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

  const locked = config.lockedAt !== null;
  const everIssued = config.firstIssuedAt !== null;
  const closed = event.status === "CANCELLED" || event.status === "DISABLED";
  const signedCount = signers.filter((signer) => signer.status === "SIGNED").length;

  const designStatus = locked
    ? { label: "Terkunci", tone: "done" as const }
    : { label: "Bisa diubah", tone: "todo" as const };
  const signerStatus =
    signers.length === 0
      ? { label: "Belum ada", tone: "todo" as const }
      : signedCount === signers.length
        ? { label: "Semua sudah tanda tangan", tone: "done" as const }
        : { label: `${signedCount} dari ${signers.length} sudah tanda tangan`, tone: "progress" as const };
  const issueStatus =
    blocker !== null
      ? { label: "Belum bisa", tone: "todo" as const }
      : stats.waiting > 0
        ? { label: "Siap diterbitkan", tone: "progress" as const }
        : stats.issued > 0
          ? { label: `${stats.issued} terbit`, tone: "done" as const }
          : { label: "Menunggu check-in", tone: "todo" as const };

  return (
    <div className="flex flex-col gap-6">
      <CertificateStep
        id="step-design"
        number="01"
        title="Desain sertifikat"
        status={designStatus}
        description={
          locked ? (
            <span className="inline-flex items-center gap-1.5">
              <Lock className="size-3.5" aria-hidden="true" />
              Desain terkunci karena penandatangan sudah menyetujui.
            </span>
          ) : (
            "Desain belum terkunci. Terkunci otomatis setelah tanda tangan pertama."
          )
        }
        aside={locked && !everIssued && !closed ? <UnlockDesignButton eventId={event.id} /> : null}
      >
        <CertificateLayoutEditor
          eventId={event.id}
          initialLayout={config.layout}
          signers={signers.map((signer) => ({ name: signer.name, title: signer.title }))}
          locked={locked}
        />
      </CertificateStep>

      <CertificateStep
        id="step-signers"
        number="02"
        title="Penandatangan"
        status={signerStatus}
        description="1 sampai 3 orang. Setiap penandatangan membuka tautan, melihat pratinjau, lalu menggambar tanda tangan di HP-nya."
      >
        <SignerPanel eventId={event.id} signers={signerRows} locked={locked} closed={closed} />
      </CertificateStep>

      <CertificateStep
        id="step-issue"
        number="03"
        title="Terbitkan"
        status={issueStatus}
        description="Sertifikat hanya untuk peserta yang sudah check-in. Peserta yang check-in setelahnya bisa disusulkan."
      >
        <IssuePanel
          eventId={event.id}
          blocker={blocker}
          issued={stats.issued}
          waiting={stats.waiting}
          everIssued={everIssued}
        />
      </CertificateStep>

      {certificates.length > 0 ? <IssuedList eventId={event.id} certificates={certificates} /> : null}
    </div>
  );
}
