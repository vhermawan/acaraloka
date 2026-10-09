export class BackgroundUnavailableError extends Error {
  constructor() {
    super("Gambar latar sertifikat tidak dapat dimuat.");
  }
}

const BACKGROUND_UNAVAILABLE_MESSAGE =
  "Gambar latar sertifikat tidak dapat dimuat saat ini. Hubungi penyelenggara acara.";

export function backgroundUnavailableResponse() {
  return new Response(BACKGROUND_UNAVAILABLE_MESSAGE, {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, no-store" },
  });
}
