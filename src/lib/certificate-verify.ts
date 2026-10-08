export const MAX_CERTIFICATE_NUMBER_LENGTH = 64;

export function normalizeCertificateNumber(raw: string): string | null {
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const normalized = decoded.trim().toUpperCase();
  if (normalized.length === 0 || normalized.length > MAX_CERTIFICATE_NUMBER_LENGTH) return null;
  return normalized;
}
