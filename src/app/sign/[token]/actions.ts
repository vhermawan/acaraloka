"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { declineReasonSchema } from "@/lib/validation/signer";
import { decodeSignaturePng } from "@/server/signature-image";
import { declineWithToken, findSignerByToken, signWithToken } from "@/server/signers";

const LINK_ERROR = "Tautan ini sudah tidak berlaku. Minta panitia membuat tautan baru.";

async function revalidateOrganizer(token: string) {
  const signer = await findSignerByToken(token);
  if (signer) revalidatePath(`/organizer/events/${signer.eventId}/certificate`);
}

export async function submitSignature(token: string, dataUrl: string, agreed: boolean): Promise<{ error?: string }> {
  if (!agreed) return { error: "Centang persetujuan dulu sebelum mengirim tanda tangan." };
  const signaturePng = decodeSignaturePng(dataUrl);
  if (!signaturePng) return { error: "Gambar tanda tangan tidak terbaca. Hapus lalu gambar ulang." };

  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip");
  const result = await signWithToken({ token, signaturePng, ip, userAgent: requestHeaders.get("user-agent") });
  if (!result.ok) return { error: LINK_ERROR };

  await revalidateOrganizer(token);
  return {};
}

export async function declineSigning(token: string, reason: string): Promise<{ error?: string }> {
  const parsed = declineReasonSchema.safeParse(reason);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const declined = await declineWithToken({ token, reason: parsed.data });
  if (!declined) return { error: LINK_ERROR };

  await revalidateOrganizer(token);
  return {};
}
