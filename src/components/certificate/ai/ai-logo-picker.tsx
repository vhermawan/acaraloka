"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { createAiLogoUpload, deleteAiLogo, finalizeAiLogo } from "@/actions/event-certificate-ai";
import { Button } from "@/components/ui/button";
import { LOGO_CONTENT_TYPES, LOGO_INVALID_MESSAGE, LOGO_MAX_BYTES } from "@/lib/ai/generate-input";
import { cn } from "cn";

const ACCEPT = Object.keys(LOGO_CONTENT_TYPES).join(",");
const optionActive = "border-primary bg-primary/8 text-primary hover:bg-primary/10 hover:text-primary";

export type LogoOption = { path: string; url: string | null };

type AiLogoPickerProps = {
  eventId: string;
  idPrefix: string;
  logos: LogoOption[];
  value: string | null;
  onChange: (path: string | null) => void;
  disabled?: boolean;
};

function AiLogoPicker({ eventId, idPrefix, logos, value, onChange, disabled = false }: AiLogoPickerProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const blocked = disabled || busy;

  async function handleFile(file: File) {
    if (!(file.type in LOGO_CONTENT_TYPES) || file.size > LOGO_MAX_BYTES) {
      toast.error(LOGO_INVALID_MESSAGE);
      return;
    }
    setBusy(true);
    try {
      const signed = await createAiLogoUpload(eventId, { contentType: file.type, size: file.size });
      if ("error" in signed) throw new Error(signed.error);

      const body = new FormData();
      body.append("cacheControl", "3600");
      body.append("", file);
      const response = await fetch(signed.uploadUrl, { method: "PUT", body, headers: { "x-upsert": "false" } });
      if (!response.ok) throw new Error("Upload logo gagal. Coba lagi.");

      const finalized = await finalizeAiLogo(eventId, signed.path);
      if ("error" in finalized) throw new Error(finalized.error);

      onChange(finalized.path);
      toast.success("Logo disimpan.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload logo gagal. Coba lagi.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete() {
    if (!value) return;
    setBusy(true);
    try {
      const result = await deleteAiLogo(eventId, value);
      if (result.error) throw new Error(result.error);
      onChange(null);
      toast.success("Logo dihapus.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Logo belum bisa dihapus. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span id={`${idPrefix}-label`} className="text-sm font-medium">
        Logo (opsional)
      </span>
      <div role="group" aria-labelledby={`${idPrefix}-label`} className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className={cn("h-12 px-3", value === null && optionActive)}
          aria-pressed={value === null}
          disabled={blocked}
          onClick={() => onChange(null)}
        >
          Tanpa logo
        </Button>
        {logos.map((logo, index) => (
          <Button
            key={logo.path}
            type="button"
            variant="outline"
            className={cn("size-12 overflow-hidden p-1", value === logo.path && optionActive)}
            aria-pressed={value === logo.path}
            aria-label={`Logo ${index + 1}`}
            disabled={blocked}
            onClick={() => onChange(logo.path)}
          >
            {logo.url ? (
              <Image src={logo.url} alt="" width={40} height={40} unoptimized className="size-full object-contain" />
            ) : (
              <span className="text-xs">{index + 1}</span>
            )}
          </Button>
        ))}
        <input
          ref={inputRef}
          id={`${idPrefix}-file`}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          disabled={blocked}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <Button type="button" variant="outline" className="h-12 gap-2 px-3" disabled={blocked} onClick={() => inputRef.current?.click()}>
          <Upload aria-hidden="true" />
          {busy ? "Memproses..." : "Unggah logo"}
        </Button>
        {value ? (
          <Button type="button" variant="ghost" className="h-12 gap-2 px-3" disabled={blocked} onClick={() => void handleDelete()}>
            <Trash2 aria-hidden="true" />
            Hapus logo ini
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        PNG atau JPG, maksimal 2 MB, logo transparan disarankan. Logo tidak dikirim ke AI. Logo bisa diganti atau dihapus
        kapan saja tanpa membuat desain ulang.
      </p>
    </div>
  );
}

export { AiLogoPicker };
