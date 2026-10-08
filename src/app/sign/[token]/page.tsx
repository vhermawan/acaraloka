import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { SignForm } from "@/components/sign/sign-form";
import { signerLinkState } from "@/lib/validation/signer";
import { formatCertificateDate } from "@/server/certificate-config";
import { findSignerByToken } from "@/server/signers";

export const metadata: Metadata = {
  title: "Tanda tangan sertifikat",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Container className="flex max-w-xl flex-col gap-3 py-16">
      <h1 className="text-balance text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-pretty text-muted-foreground">{children}</p>
    </Container>
  );
}

export default async function SignPage({ params }: PageProps<"/sign/[token]">) {
  const { token } = await params;
  const signer = await findSignerByToken(token);

  if (!signer) {
    return (
      <Notice title="Tautan tidak berlaku">
        Tautan ini salah, sudah dibuat ulang, atau desain sertifikat diubah. Minta tautan baru ke panitia acara.
      </Notice>
    );
  }

  const { event } = signer;
  if (event.status === "CANCELLED" || event.status === "DISABLED") {
    return <Notice title="Acara ditutup">Acara {event.title} sudah dibatalkan, jadi sertifikat tidak perlu ditandatangani.</Notice>;
  }

  const state = signerLinkState(signer);
  if (state === "SIGNED") {
    return (
      <Notice title="Tanda tangan sudah tersimpan">
        Terima kasih, {signer.name}. Tanda tangan Anda untuk sertifikat {event.title} sudah diterima panitia. Halaman ini
        boleh ditutup.
      </Notice>
    );
  }
  if (state === "DECLINED") {
    return (
      <Notice title="Anda menolak menandatangani">
        Panitia {event.organizer.orgName} sudah menerima alasan Anda. Kalau berubah pikiran, minta tautan baru ke panitia.
      </Notice>
    );
  }
  if (state === "EXPIRED") {
    return (
      <Notice title="Tautan kedaluwarsa">
        Tautan tanda tangan berlaku 14 hari. Minta panitia {event.organizer.orgName} membuat tautan baru.
      </Notice>
    );
  }

  return (
    <Container className="flex max-w-2xl flex-col gap-8 py-12">
      <header className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">{event.organizer.orgName} meminta tanda tangan Anda</p>
        <h1 className="text-balance text-2xl font-semibold tracking-tight">{event.title}</h1>
        <p className="text-sm text-muted-foreground">{formatCertificateDate(event.startAt, event.timezone)}</p>
      </header>

      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-muted-foreground">Nama</dt>
        <dd className="font-medium">{signer.name}</dd>
        <dt className="text-muted-foreground">Jabatan</dt>
        <dd className="font-medium">{signer.title}</dd>
      </dl>

      <SignForm token={token} />
    </Container>
  );
}
