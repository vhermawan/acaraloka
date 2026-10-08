"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageIcon, Upload } from "lucide-react";
import { toast } from "sonner";

import { createPosterUpload, setEventPoster } from "@/app/organizer/events/actions";
import { Button } from "@/components/ui/button";
import { POSTER_CONTENT_TYPES, validatePosterFile } from "@/lib/validation/event";

type PosterUploaderProps = {
  eventId: string;
  posterUrl: string | null;
  disabled?: boolean;
};

const ACCEPT = Object.keys(POSTER_CONTENT_TYPES).join(",");

function PosterUploader({ eventId, posterUrl, disabled }: PosterUploaderProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    const invalid = validatePosterFile(file.type, file.size);
    if (invalid) {
      toast.error(invalid);
      return;
    }

    setUploading(true);
    try {
      const signed = await createPosterUpload(eventId, { contentType: file.type, size: file.size });
      if ("error" in signed) throw new Error(signed.error);

      const body = new FormData();
      body.append("cacheControl", "3600");
      body.append("", file);
      const response = await fetch(signed.uploadUrl, { method: "PUT", body, headers: { "x-upsert": "false" } });
      if (!response.ok) throw new Error("Upload poster gagal. Coba lagi.");

      const result = await setEventPoster(eventId, signed.path);
      if (result.error) throw new Error(result.error);

      toast.success("Poster diperbarui.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload poster gagal. Coba lagi.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative flex aspect-[4/5] w-full max-w-60 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted lg:max-w-none">
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt="Poster acara"
            width={240}
            height={300}
            unoptimized
            className="size-full object-cover"
          />
        ) : (
          <span className="flex flex-col items-center gap-2 px-4 text-center text-sm text-muted-foreground">
            <ImageIcon className="size-6" strokeWidth={1.5} aria-hidden="true" />
            Belum ada poster
          </span>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        id="poster-input"
        disabled={disabled || uploading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <div className="flex flex-col gap-1">
        <Button
          type="button"
          variant="outline"
          className="h-10 w-fit gap-2 px-4 lg:w-full"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
        >
          <Upload aria-hidden="true" />
          {uploading ? "Mengunggah..." : posterUrl ? "Ganti poster" : "Unggah poster"}
        </Button>
        <p className="text-xs text-muted-foreground">JPG, PNG, atau WebP. Maksimal 2 MB.</p>
      </div>
    </div>
  );
}

export { PosterUploader };
