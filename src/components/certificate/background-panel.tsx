"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { applyBackground, createBackgroundUpload, removeBackground } from "@/app/organizer/events/[id]/certificate/actions";
import { Button } from "@/components/ui/button";
import {
  BACKGROUND_CONTENT_TYPES,
  BACKGROUND_MAX_BYTES,
  BACKGROUND_MIN_WIDTH,
  BACKGROUND_SIZE_HINT,
  validateBackgroundDimensions,
} from "@/lib/certificate-background";
import { compressImage, readImageSize } from "@/lib/image-compress";
import { cn } from "cn";

const ACCEPT = Object.keys(BACKGROUND_CONTENT_TYPES).join(",");
const optionActive = "border-primary bg-primary/8 text-primary hover:bg-primary/10 hover:text-primary";

type BackgroundPanelProps = {
  eventId: string;
  hasBackground: boolean;
  locked: boolean;
  closed: boolean;
};

function BackgroundPanel({ eventId, hasBackground, locked, closed }: BackgroundPanelProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [wantsUpload, setWantsUpload] = useState(hasBackground);
  const [busy, setBusy] = useState(false);
  const uploadMode = hasBackground || wantsUpload;
  const disabled = locked || closed || busy;

  async function handleFile(file: File) {
    if (!(file.type in BACKGROUND_CONTENT_TYPES)) {
      toast.error("Gambar latar harus berformat PNG atau JPG.");
      return;
    }
    setBusy(true);
    try {
      const size = await readImageSize(file).catch(() => null);
      if (!size) throw new Error("Gambar tidak bisa dibaca. Coba berkas PNG atau JPG lain.");
      const dimensions = validateBackgroundDimensions(size.width, size.height);
      if (!dimensions.ok) throw new Error(dimensions.error);

      const prepared = await compressImage(file, { maxBytes: BACKGROUND_MAX_BYTES, minWidth: BACKGROUND_MIN_WIDTH });
      if (!prepared) throw new Error("Gambar tidak bisa dikompres sampai 3 MB. Gunakan gambar yang lebih sederhana.");

      const signed = await createBackgroundUpload(eventId, {
        contentType: prepared.contentType,
        size: prepared.blob.size,
        width: prepared.width,
        height: prepared.height,
      });
      if ("error" in signed) throw new Error(signed.error);

      const body = new FormData();
      body.append("cacheControl", "3600");
      body.append("", prepared.blob);
      const response = await fetch(signed.uploadUrl, { method: "PUT", body, headers: { "x-upsert": "false" } });
      if (!response.ok) throw new Error("Upload gambar latar gagal. Coba lagi.");

      const result = await applyBackground(eventId, signed.path);
      if (result.error) throw new Error(result.error);

      toast.success("Gambar latar disimpan.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload gambar latar gagal. Coba lagi.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove() {
    if (!window.confirm("Hapus gambar latar dan kembali ke template bawaan?")) return;
    setBusy(true);
    try {
      const result = await removeBackground(eventId);
      if (result.error) throw new Error(result.error);
      setWantsUpload(false);
      toast.success("Gambar latar dihapus.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menghapus gambar latar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-lg border border-border p-4">
      <span id="template-source-label" className="text-sm font-medium">
        Latar sertifikat
      </span>
      <div role="group" aria-labelledby="template-source-label" className="grid grid-cols-2 gap-2 sm:max-w-sm">
        <Button
          type="button"
          variant="outline"
          className={cn("h-10", !uploadMode && optionActive)}
          aria-pressed={!uploadMode}
          disabled={disabled}
          onClick={() => (hasBackground ? void handleRemove() : setWantsUpload(false))}
        >
          Template bawaan
        </Button>
        <Button
          type="button"
          variant="outline"
          className={cn("h-10", uploadMode && optionActive)}
          aria-pressed={uploadMode}
          disabled={disabled}
          onClick={() => setWantsUpload(true)}
        >
          Gambar sendiri
        </Button>
      </div>

      {uploadMode ? (
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            id="certificate-background-input"
            disabled={disabled}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 gap-2 px-4"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              <Upload aria-hidden="true" />
              {busy ? "Memproses..." : hasBackground ? "Ganti gambar latar" : "Unggah gambar latar"}
            </Button>
            {hasBackground ? (
              <Button type="button" variant="ghost" className="h-10 gap-2 px-4" disabled={disabled} onClick={() => void handleRemove()}>
                <Trash2 aria-hidden="true" />
                Hapus gambar latar
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            PNG atau JPG, rasio A4 lanskap atau 16:9 (toleransi 2%), lebar minimal {BACKGROUND_MIN_WIDTH} px. Gambar
            dikompres otomatis sampai maksimal 3 MB. Ukuran yang disarankan: {BACKGROUND_SIZE_HINT}.
          </p>
          <p className="text-xs text-muted-foreground">
            Judul, border, dan aksen bawaan tidak dipakai. Atur nama, acara, tanggal, nomor, tanda tangan, dan QR di atas
            gambar Anda.
          </p>
          {locked ? (
            <p className="text-xs text-muted-foreground">Desain terkunci, gambar latar tidak bisa diubah.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export { BackgroundPanel };
