import { z } from "zod";

export const signerSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(100, "Nama maksimal 100 karakter."),
  title: z.string().trim().min(2, "Jabatan minimal 2 karakter.").max(100, "Jabatan maksimal 100 karakter."),
  email: z.string().trim().toLowerCase().pipe(z.email("Format email tidak valid.")),
});

export const declineReasonSchema = z
  .string()
  .trim()
  .min(3, "Tulis alasan singkat, minimal 3 karakter.")
  .max(300, "Alasan maksimal 300 karakter.");

export const SIGNER_LINK_TTL_MS = 14 * 24 * 60 * 60 * 1000;
export const MAX_SIGNATURE_BYTES = 300 * 1024;

export type SignerLinkState = "ACTIVE" | "EXPIRED" | "SIGNED" | "DECLINED";

export function signerLinkState(signer: { status: string; tokenExpiresAt: Date }, now = new Date()): SignerLinkState {
  if (signer.status === "SIGNED") return "SIGNED";
  if (signer.status === "DECLINED") return "DECLINED";
  return signer.tokenExpiresAt <= now ? "EXPIRED" : "ACTIVE";
}

export const SIGNER_STATUS_LABELS: Record<SignerLinkState, string> = {
  ACTIVE: "Menunggu",
  EXPIRED: "Tautan kedaluwarsa",
  SIGNED: "Sudah tanda tangan",
  DECLINED: "Menolak",
};
