"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  createSigner,
  deleteSigner,
  regenerateLink,
  unlockDesign,
  type SignerFormState,
} from "@/app/organizer/events/[id]/certificate/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MAX_SIGNERS } from "@/lib/certificate-layout";
import { SIGNER_STATUS_LABELS, type SignerLinkState } from "@/lib/validation/signer";

export type SignerRow = {
  id: string;
  name: string;
  title: string;
  email: string;
  state: SignerLinkState;
  declineReason: string | null;
};

const STATE_VARIANTS = {
  ACTIVE: "outline",
  EXPIRED: "secondary",
  SIGNED: "default",
  DECLINED: "destructive",
} as const;

function toErrors(messages?: string[]) {
  return messages?.map((message) => ({ message }));
}

function ShareLink({ signerName, url, onClose }: { signerName: string; url: string; onClose: () => void }) {
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

function UnlockButton({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await unlockDesign(eventId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Desain dibuka. Semua tanda tangan direset.");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" className="h-11 w-fit px-4" />}>Buka kunci desain</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Buka kunci desain?</DialogTitle>
          <DialogDescription>
            Semua tanda tangan yang sudah masuk dihapus dan tautan lama tidak berlaku. Setelah mengubah desain, buat ulang
            tautan dan minta semua penandatangan tanda tangan lagi.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Tidak jadi</DialogClose>
          <Button variant="destructive" onClick={confirm} disabled={pending}>
            {pending ? "Membuka..." : "Buka kunci dan reset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type SignerPanelProps = {
  eventId: string;
  signers: SignerRow[];
  locked: boolean;
  issued: boolean;
  closed: boolean;
};

function SignerPanel({ eventId, signers, locked, issued, closed }: SignerPanelProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<SignerFormState, FormData>(
    createSigner.bind(null, eventId),
    {},
  );
  const [regenerated, setRegenerated] = useState<{ signerName: string; url: string; issuedAt: number } | null>(null);
  const [dismissedAt, setDismissedAt] = useState(0);
  const [rowPending, startRow] = useTransition();
  const errors = state.errors ?? {};
  const values = state.values ?? {};
  const canAdd = !locked && !closed && signers.length < MAX_SIGNERS;

  const latest = [state.link, regenerated]
    .filter((link) => link !== undefined && link !== null)
    .sort((a, b) => b.issuedAt - a.issuedAt)[0];
  const shared = latest && latest.issuedAt > dismissedAt ? latest : null;

  useEffect(() => {
    if (state.link) formRef.current?.reset();
  }, [state.link]);

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

  function handleDelete(signer: SignerRow) {
    startRow(async () => {
      const result = await deleteSigner(eventId, signer.id);
      if (result.error) toast.error(result.error);
      else toast.success(`${signer.name} dihapus dari penandatangan.`);
    });
  }

  return (
    <section aria-labelledby="signers-heading" className="flex flex-col gap-4">
      <div className="flex max-w-prose flex-col gap-1">
        <h2 id="signers-heading" className="text-lg font-semibold">
          Penandatangan
        </h2>
        <p className="text-sm text-muted-foreground">
          1 sampai 3 orang. Setiap penandatangan membuka tautan, melihat pratinjau, lalu menggambar tanda tangan di HP-nya.
          Desain terkunci setelah tanda tangan pertama masuk.
        </p>
      </div>

      {shared ? <ShareLink signerName={shared.signerName} url={shared.url} onClose={() => setDismissedAt(Date.now())} /> : null}

      {signers.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Belum ada penandatangan.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {signers.map((signer) => (
            <li key={signer.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{signer.name}</p>
                  <Badge variant={STATE_VARIANTS[signer.state]}>{SIGNER_STATUS_LABELS[signer.state]}</Badge>
                </div>
                <p className="text-muted-foreground">
                  {signer.title} · <span className="break-all">{signer.email}</span>
                </p>
                {signer.state === "DECLINED" && signer.declineReason ? (
                  <p className="mt-1">Alasan: {signer.declineReason}</p>
                ) : null}
              </div>
              {signer.state !== "SIGNED" && !closed ? (
                <div className="flex shrink-0 gap-2">
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-11 px-3"
                      disabled={rowPending}
                      onClick={() => handleDelete(signer)}
                    >
                      Hapus
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canAdd ? (
        <form ref={formRef} action={formAction} noValidate className="flex flex-col gap-3">
          <h3 className="text-sm font-medium">Tambah penandatangan</h3>
          {state.message ? (
            <p role="alert" className="text-sm text-destructive">
              {state.message}
            </p>
          ) : null}
          <div className="grid gap-3 md:grid-cols-3">
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="signer-name">Nama lengkap dan gelar</FieldLabel>
              <Input id="signer-name" name="name" required defaultValue={values.name} aria-invalid={!!errors.name} />
              <FieldError errors={toErrors(errors.name)} />
            </Field>
            <Field data-invalid={!!errors.title}>
              <FieldLabel htmlFor="signer-title">Jabatan</FieldLabel>
              <Input
                id="signer-title"
                name="title"
                required
                placeholder="Ketua Pelaksana"
                defaultValue={values.title}
                aria-invalid={!!errors.title}
              />
              <FieldError errors={toErrors(errors.title)} />
            </Field>
            <Field data-invalid={!!errors.email}>
              <FieldLabel htmlFor="signer-email">Email</FieldLabel>
              <Input
                id="signer-email"
                name="email"
                type="email"
                inputMode="email"
                required
                defaultValue={values.email}
                aria-invalid={!!errors.email}
              />
              <FieldError errors={toErrors(errors.email)} />
            </Field>
          </div>
          <Button type="submit" className="h-11 w-fit px-4" disabled={pending}>
            {pending ? "Menambahkan..." : "Tambah dan buat tautan"}
          </Button>
        </form>
      ) : null}

      {locked && !issued && !closed ? <UnlockButton eventId={eventId} /> : null}
    </section>
  );
}

export { SignerPanel };
