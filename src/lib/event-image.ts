export const EVENT_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const EVENT_IMAGE_CONTENT_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type EventImageContentType = keyof typeof EVENT_IMAGE_CONTENT_TYPES;
export type EventImageExtension = (typeof EVENT_IMAGE_CONTENT_TYPES)[EventImageContentType];

export function validateEventImageFile(contentType: string, size: number): string | null {
  if (!(contentType in EVENT_IMAGE_CONTENT_TYPES)) return "Gambar harus berformat JPG, PNG, atau WebP.";
  if (size <= 0 || size > EVENT_IMAGE_MAX_BYTES) return "Ukuran gambar maksimal 2 MB.";
  return null;
}

const EVENT_IMAGE_PATH = /^([A-Za-z0-9_-]+)\/[0-9a-f]{16}\.(jpg|png|webp)$/;

export function isEventImagePath(path: string): boolean {
  return EVENT_IMAGE_PATH.test(path);
}

export function isEventImagePathFor(organizerId: string, path: string): boolean {
  const match = EVENT_IMAGE_PATH.exec(path);
  return match !== null && match[1] === organizerId;
}

export function eventImageExtension(path: string): EventImageExtension | null {
  const match = EVENT_IMAGE_PATH.exec(path);
  return match ? (match[2] as EventImageExtension) : null;
}

function startsWith(bytes: Uint8Array, signature: number[], offset = 0) {
  return signature.every((value, index) => bytes[offset + index] === value);
}

export function hasImageSignature(bytes: Uint8Array, extension: EventImageExtension): boolean {
  if (extension === "png") return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (extension === "jpg") return startsWith(bytes, [0xff, 0xd8, 0xff]);
  return startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8);
}
