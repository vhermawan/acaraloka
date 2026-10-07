import "server-only";

import { MAX_SIGNATURE_BYTES } from "@/lib/validation/signer";

const PNG_DATA_URL_PREFIX = "data:image/png;base64,";
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function decodeSignaturePng(dataUrl: unknown): Uint8Array | null {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith(PNG_DATA_URL_PREFIX)) return null;
  const base64 = dataUrl.slice(PNG_DATA_URL_PREFIX.length);
  if (base64.length > Math.ceil((MAX_SIGNATURE_BYTES * 4) / 3) + 4) return null;
  const bytes = Uint8Array.from(Buffer.from(base64, "base64"));
  if (bytes.length < 67 || bytes.length > MAX_SIGNATURE_BYTES) return null;
  return PNG_MAGIC.every((byte, index) => bytes[index] === byte) ? bytes : null;
}
