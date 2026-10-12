import "server-only";

import { randomBytes } from "node:crypto";

import { LOGO_INVALID_MESSAGE, LOGO_MAX_BYTES } from "@/lib/ai/generate-input";
import { aiLogoPath, isAiRawLogoPathFor } from "@/lib/ai/paths";
import { hasBackgroundSignature } from "@/lib/certificate-background";
import { ImageOpsError, normalizeLogo } from "@/server/ai/image-ops";
import { AI_BUCKET, downloadObject, uploadObject } from "@/server/storage";
import { removeObjectsQuietly } from "@/server/storage-cleanup";

export type LogoResult = { ok: true; path: string } | { ok: false; error: string };

export type LogoDeps = {
  download: (path: string) => Promise<Uint8Array>;
  upload: (path: string, body: Uint8Array, contentType: string) => Promise<void>;
  removeRaw: (path: string) => Promise<void>;
  newId: () => string;
};

export function defaultLogoDeps(): LogoDeps {
  return {
    download: (path) => downloadObject(AI_BUCKET, path),
    upload: (path, body, contentType) => uploadObject(AI_BUCKET, path, body, contentType),
    removeRaw: (path) => removeObjectsQuietly("ai.logo.raw", AI_BUCKET, [path]),
    newId: () => randomBytes(8).toString("hex"),
  };
}

function looksLikeSupportedImage(bytes: Uint8Array): boolean {
  return hasBackgroundSignature(bytes, "png") || hasBackgroundSignature(bytes, "jpg");
}

export async function finalizeLogoUpload(
  eventId: string,
  rawPath: string,
  deps: LogoDeps = defaultLogoDeps(),
): Promise<LogoResult> {
  if (!isAiRawLogoPathFor(eventId, rawPath)) return { ok: false, error: LOGO_INVALID_MESSAGE };

  try {
    let bytes: Uint8Array;
    try {
      bytes = await deps.download(rawPath);
    } catch {
      return { ok: false, error: "Logo belum terunggah. Coba unggah lagi." };
    }
    if (bytes.byteLength === 0 || bytes.byteLength > LOGO_MAX_BYTES) return { ok: false, error: LOGO_INVALID_MESSAGE };
    if (!looksLikeSupportedImage(bytes)) return { ok: false, error: LOGO_INVALID_MESSAGE };

    let normalized;
    try {
      normalized = await normalizeLogo(bytes);
    } catch (error) {
      if (error instanceof ImageOpsError) {
        return {
          ok: false,
          error:
            error.code === "BAD_DIMENSIONS"
              ? "Ukuran logo harus antara 64 dan 4096 piksel."
              : "Logo tidak bisa dibaca. Coba berkas PNG atau JPG lain.",
        };
      }
      throw error;
    }

    const path = aiLogoPath(eventId, deps.newId());
    await deps.upload(path, normalized.bytes, "image/png");
    return { ok: true, path };
  } finally {
    await deps.removeRaw(rawPath);
  }
}
