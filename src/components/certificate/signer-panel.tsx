"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  createSigner,
  deleteSigner,
  emailSignerLink,
  regenerateLink,
  type SignerFormState,
} from "@/app/organizer/events/[id]/certificate/actions";
import { ConfirmActionButton } from "@/components/events/confirm-action-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useActionForm } from "@/hooks/use-action-form";
import { MAX_SIGNERS } from "@/lib/certificate-layout";
import { SIGNER_STATUS_LABELS, signerSchema, type SignerLinkState } from "@/lib/validation/signer";

export type SignerRow = {
  id: string;
  name: string;
  title: string;
  email: string;
  state: SignerLinkState;
  declineReason: string | null;
};

const STATE_STYLES: Record<SignerLinkState, string> = {
  ACTIVE: "border-border text-muted-foreground",
  EXPIRED: "border-transparent bg-[#CA8A04]/10 text-[#8A5A00] dark:text-[#FACC15]",
  SIGNED: "border-transparent bg-success/10 text-success",
  DECLINED: "border-transparent bg-destructive/10 text-destructive",
};

type ShareLinkProps = { signerName: string; url: string; emailedTo?: string; onClose: () => void };

function ShareLink({ signerName, url, emailedTo, onClose }: ShareLinkProps) {
  const message = `Halo ${signerName}, mohon tanda tangani sertifikat acara kami lewat tautan ini: ${url}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Tautan disalin.");
    } catch {
      toast.error("Gagal menyalin. Pilih teks tautan lalu salin manual.");
    }
  }

  return (
    <div role="status" className="flex flex-col gap-3 rounded-lg border border-primary/40 bg-primary/5 p-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">Tautan tanda tangan untuk {signerName}</p>
        <p className="text-sm text-muted-foreground">
          Tautan ini hanya tampil sekali dan berlaku 14 hari. Kalau hilang, buat ulang tautan.
        </p>
        {emailedTo ? (
          <p className="text-sm text-muted-foreground">
            Undangan berisi tautan yang sama juga dikirim ke <span className="break-all font-medium text-foreground">{emailedTo}</span>.
          </p>
        ) : null}
      </div>
      <label className="sr-only" htmlFor="signer-link">
        Tautan tanda tangan
      </label>
      <Input id="signer-link" readOnly value={url} onFocus={(event) => event.currentTarget.select()} className="h-11 font-mono text-xs" />
      <div className="flex flex-wrap gap-2">
        <Button type="button" className="h-11 px-4" onClick={copy}>
          Salin tautan
        </Button>
        <Button
          variant="outline"
          className="h-11 px-4"
          nativeButton={false}
          render={<a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" />}
        >
          Bagikan ke WhatsApp
        </Button>
        <Button type="button" variant="ghost" className="h-11" onClick={onClose}>
          Tutup
        </Button>
      </div>
    </div>
  );
}

type SignerPanelProps = {
  eventId: string;
  signers: SignerRow[];
  locked: boolean;
  closed: boolean;
  emailEnabled: boolean;
};

function SignerPanel({ eventId, signers, locked, closed, emailEnabled }: SignerPanelProps) {
  const [state, formAction, pending] = useActionState<SignerFormState, FormData>(
    createSigner.bind(null, eventId),
    {},
  );
  const [regenerated, setRegenerated] = useState<{ signerName: string; url: string; issuedAt: number; emailedTo?: string } | null>(
    null,
  );
  const [dismissedAt, setDismissedAt] = useState(0);
  const [rowPending, startRow] = useTransition();
  const {
    form: {
      register,
      reset,
      formState: { errors },
    },
    onSubmit,
  } = useActionForm(signerSchema, {
    defaultValues: { name: "", title: "", email: "" },
    dispatch: formAction,
    serverErrors: state.errors,
  });
  const canAdd = !locked && !closed && signers.length < MAX_SIGNERS;

  const latest = [state.link, regenerated]
    .filter((link) => link !== undefined && link !== null)
    .sort((a, b) => b.issuedAt - a.issuedAt)[0];
  const shared = latest && latest.issuedAt > dismissedAt ? latest : null;

  useEffect(() => {
    if (!state.link) return;
    reset();
    toast.success(
      state.link.emailedTo
        ? `${state.link.signerName} ditambahkan. Undangan dikirim ke ${state.link.emailedTo}.`
        : `${state.link.signerName} ditambahkan. Bagikan tautan tanda tangannya.`,
    );
  }, [state.link, reset]);

  function handleRegenerate(signer: SignerRow) {
    startRow(async () => {
      const result = await regenerateLink(eventId, signer.id);
      if (result.error || !result.url) {
        toast.error(result.error ?? "Gagal membuat tautan.");
        return;
      }
      setRegenerated({ signerName: signer.name, url: result.url, issuedAt: Date.now() });
    });
  }

  function handleEmail(signer: SignerRow) {
    startRow(async () => {
      const result = await emailSignerLink(eventId, signer.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setDismissedAt(Date.now());
      toast.success(`Undangan dikirim ke ${signer.email}. Tautan sebelumnya tidak berlaku lagi.`);
    });
  }

  return (
    <div className="flex flex-col gap-4">

      {shared ? (
        <ShareLink
          signerName={shared.signerName}
          url={shared.url}
          emailedTo={shared.emailedTo}
          onClose={() => setDismissedAt(Date.now())}
        />
      ) : null}

      {signers.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Belum ada penandatangan.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {signers.map((signer) => (
            <li key={signer.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{signer.name}</p>
                  <Badge variant="outline" className={STATE_STYLES[signer.state]}>{SIGNER_STATUS_LABELS[signer.state]}</Badge>
                </div>
                <p className="text-muted-foreground">
                  {signer.title} · <span className="break-all">{signer.email}</span>
                </p>
                {signer.state === "DECLINED" && signer.declineReason ? (
                  <p className="mt-1">Alasan: {signer.declineReason}</p>
                ) : null}
              </div>
              {signer.state !== "SIGNED" && !closed ? (
                <div className="flex shrink-0 flex-wrap gap-2">
                  {emailEnabled ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-11 px-3"
                      disabled={rowPending}
                      onClick={() => handleEmail(signer)}
                    >
                      Kirim via email
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-11 px-3"
                    disabled={rowPending}
                    onClick={() => handleRegenerate(signer)}
                  >
                    Buat ulang tautan
                  </Button>
                  {!locked ? (
                    <ConfirmActionButton
                      triggerLabel="Hapus"
                      triggerAriaLabel={`Hapus penandatangan ${signer.name}`}
                      title={`Hapus ${signer.name} dari penandatangan?`}
                      description="Tautan tanda tangan untuknya tidak berlaku lagi."
                      confirmLabel="Hapus"
                      pendingLabel="Menghapus..."
                      successMessage={`${signer.name} dihapus dari penandatangan.`}
                      disabled={rowPending}
                      action={() => deleteSigner(eventId, signer.id)}
                    />
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canAdd ? (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3 border-t border-border pt-5">
          <h3 className="text-sm font-semibold">Tambah penandatangan</h3>
          {state.message ? (
            <p role="alert" className="text-sm text-destructive">
              {state.message}
            </p>
          ) : null}
          <div className="grid gap-3 md:grid-cols-3">
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="signer-name">Nama lengkap dan gelar</FieldLabel>
              <Input
                id="signer-name"
                placeholder="Contoh: Dr. Nama Lengkap, M.Kom."
                aria-invalid={!!errors.name}
                className="h-10"
                {...register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>
            <Field data-invalid={!!errors.title}>
              <FieldLabel htmlFor="signer-title">Jabatan</FieldLabel>
              <Input
                id="signer-title"
                placeholder="Contoh: Ketua Pelaksana"
                aria-invalid={!!errors.title}
                className="h-10"
                {...register("title")}
              />
              <FieldError errors={[errors.title]} />
            </Field>
            <Field data-invalid={!!errors.email}>
              <FieldLabel htmlFor="signer-email">Email</FieldLabel>
              <Input
                id="signer-email"
                type="email"
                inputMode="email"
                placeholder="nama@email.com"
                aria-invalid={!!errors.email}
                className="h-10"
                {...register("email")}
              />
              <FieldError errors={[errors.email]} />
            </Field>
          </div>
          <Button type="submit" className="h-10 w-fit px-4" disabled={pending}>
            {pending ? "Menambahkan..." : emailEnabled ? "Tambah dan kirim undangan" : "Tambah dan buat tautan"}
          </Button>
        </form>
      ) : null}

    </div>
  );
}

export { SignerPanel };
