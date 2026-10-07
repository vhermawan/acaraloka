"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { declineSigning, submitSignature } from "@/app/sign/[token]/actions";
import { SignaturePad, type SignaturePadHandle } from "@/components/sign/signature-pad";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

function SignForm({ token }: { token: string }) {
  const router = useRouter();
  const padRef = useRef<SignaturePadHandle>(null);
  const [empty, setEmpty] = useState(true);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const handleChange = useCallback((value: boolean) => setEmpty(value), []);

  function handleSubmit() {
    setError("");
    const dataUrl = padRef.current?.toPngDataUrl();
    if (!dataUrl) {
      setError("Gambar tanda tangan Anda di kotak dulu.");
      return;
    }
    startTransition(async () => {
      const result = await submitSignature(token, dataUrl, agreed);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleDecline() {
    setError("");
    startTransition(async () => {
      const result = await declineSigning(token, reason);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="preview-heading" className="flex flex-col gap-2">
        <h2 id="preview-heading" className="font-medium">
          1. Periksa desain sertifikat
        </h2>
        <p className="text-sm text-muted-foreground">
          Pratinjau memakai nama peserta contoh. Nama asli peserta diisi saat sertifikat diterbitkan.
        </p>
        <Button
          variant="outline"
          className="h-11 w-fit px-4"
          nativeButton={false}
          render={<a href={`/sign/${token}/preview`} target="_blank" rel="noopener noreferrer" />}
        >
          Buka pratinjau PDF
        </Button>
      </section>

      {declining ? (
        <section aria-labelledby="decline-heading" className="flex flex-col gap-3">
          <h2 id="decline-heading" className="font-medium">
            Tolak menandatangani
          </h2>
          <Field>
            <FieldLabel htmlFor="decline-reason">Alasan untuk panitia</FieldLabel>
            <Textarea
              id="decline-reason"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Contoh: jabatan saya salah tulis"
            />
          </Field>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="destructive" className="h-11 px-4" disabled={pending} onClick={handleDecline}>
              {pending ? "Mengirim..." : "Kirim penolakan"}
            </Button>
            <Button variant="ghost" className="h-11" onClick={() => setDeclining(false)}>
              Kembali
            </Button>
          </div>
        </section>
      ) : (
        <section aria-labelledby="sign-heading" className="flex flex-col gap-3">
          <h2 id="sign-heading" className="font-medium">
            2. Gambar tanda tangan
          </h2>
          <p className="text-sm text-muted-foreground">Pakai jari atau stylus di kotak putih di bawah.</p>
          <SignaturePad ref={padRef} onChange={handleChange} label="Kotak tanda tangan" />
          <Button
            variant="ghost"
            className="h-11 w-fit"
            disabled={empty || pending}
            onClick={() => padRef.current?.clear()}
          >
            Hapus dan gambar ulang
          </Button>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-primary"
            />
            <span>
              Saya menyetujui isi dan desain sertifikat ini, dan mengizinkan gambar tanda tangan saya dibubuhkan pada
              sertifikat peserta yang hadir. Ini bukan tanda tangan elektronik tersertifikasi.
            </span>
          </label>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button className="h-11 px-4" disabled={pending || empty || !agreed} onClick={handleSubmit}>
              {pending ? "Mengirim..." : "Setujui dan kirim tanda tangan"}
            </Button>
            <Button variant="ghost" className="h-11" onClick={() => setDeclining(true)}>
              Tolak
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

export { SignForm };
