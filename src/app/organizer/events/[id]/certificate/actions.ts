"use server";

import { revalidatePath } from "next/cache";

import { ISSUE_BLOCKER_MESSAGES } from "@/lib/certificate-issue";
import { certificateLayoutSchema } from "@/lib/certificate-layout";
import { env } from "@/lib/env";
import { revokeReasonSchema } from "@/lib/validation/certificate";
import { signerSchema } from "@/lib/validation/signer";
import { requireEventOwner } from "@/server/authz";
import { saveCertificateLayout } from "@/server/certificate-config";
import { issueCertificates, revokeCertificate } from "@/server/certificates";
import { addSigner, regenerateSignerLink, removeSigner, unlockCertificate } from "@/server/signers";

export async function saveLayout(eventId: string, layout: unknown): Promise<{ error?: string }> {
  const { event } = await requireEventOwner(eventId);
  if (event.status === "DISABLED") return { error: "Acara ini dinonaktifkan admin." };
  const parsed = certificateLayoutSchema.safeParse(layout);
  if (!parsed.success) return { error: "Posisi elemen tidak valid. Muat ulang halaman lalu coba lagi." };

  const saved = await saveCertificateLayout(event.id, parsed.data);
  if (!saved) return { error: "Desain sudah terkunci karena penandatangan sudah menyetujui." };

  revalidatePath(`/organizer/events/${event.id}/certificate`);
  return {};
}

export type SignerFormState = {
  errors?: Partial<Record<"name" | "title" | "email", string[]>>;
  message?: string;
  values?: Record<string, string>;
  link?: { signerName: string; url: string; issuedAt: number };
};

const CLOSED_STATUSES = new Set(["CANCELLED", "DISABLED"]);

function signLink(token: string) {
  return new URL(`/sign/${token}`, env.APP_BASE_URL).toString();
}

function revalidateCertificate(eventId: string) {
  revalidatePath(`/organizer/events/${eventId}/certificate`);
}

export async function createSigner(eventId: string, _prev: SignerFormState, formData: FormData): Promise<SignerFormState> {
  const { event } = await requireEventOwner(eventId);
  const values = {
    name: String(formData.get("name") ?? ""),
    title: String(formData.get("title") ?? ""),
    email: String(formData.get("email") ?? ""),
  };
  if (CLOSED_STATUSES.has(event.status)) return { message: "Acara ini sudah ditutup.", values };

  const parsed = signerSchema.safeParse(values);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values };

  const result = await addSigner({ eventId: event.id, ...parsed.data });
  if (!result.ok) {
    return {
      message:
        result.reason === "FULL"
          ? "Maksimal 3 penandatangan per acara."
          : "Desain sudah terkunci. Buka kunci dulu untuk menambah penandatangan.",
      values,
    };
  }

  revalidateCertificate(event.id);
  return { link: { signerName: parsed.data.name, url: signLink(result.token), issuedAt: Date.now() } };
}

export async function regenerateLink(
  eventId: string,
  signerId: string,
): Promise<{ error?: string; url?: string }> {
  const { user, event } = await requireEventOwner(eventId);
  if (CLOSED_STATUSES.has(event.status)) return { error: "Acara ini sudah ditutup." };
  const token = await regenerateSignerLink({ eventId: event.id, signerId, actorId: user.id });
  if (!token) return { error: "Penandatangan ini sudah tanda tangan, tautannya tidak bisa dibuat ulang." };

  revalidateCertificate(event.id);
  return { url: signLink(token) };
}

export async function deleteSigner(eventId: string, signerId: string): Promise<{ error?: string }> {
  const { event } = await requireEventOwner(eventId);
  if (event.status === "DISABLED") return { error: "Acara ini dinonaktifkan admin." };
  const removed = await removeSigner({ eventId: event.id, signerId });
  if (!removed) return { error: "Penandatangan tidak bisa dihapus saat desain terkunci atau setelah tanda tangan." };

  revalidateCertificate(event.id);
  return {};
}

export async function unlockDesign(eventId: string): Promise<{ error?: string }> {
  const { user, event } = await requireEventOwner(eventId);
  if (event.status === "DISABLED") return { error: "Acara ini dinonaktifkan admin." };
  const result = await unlockCertificate({ eventId: event.id, actorId: user.id });
  if (!result.ok) {
    return {
      error:
        result.reason === "ISSUED"
          ? "Sertifikat sudah terbit, desain tidak bisa dibuka lagi."
          : "Desain tidak dalam keadaan terkunci.",
    };
  }

  revalidateCertificate(event.id);
  return {};
}

export async function issueEventCertificates(eventId: string): Promise<{ error?: string; issued?: number }> {
  const { user, event } = await requireEventOwner(eventId);
  const result = await issueCertificates(event.id, user.id);
  if (!result.ok) {
    return { error: result.reason === "NOT_FOUND" ? "Acara tidak ditemukan." : ISSUE_BLOCKER_MESSAGES[result.reason] };
  }

  revalidateCertificate(event.id);
  return { issued: result.issued };
}

export async function revokeEventCertificate(
  eventId: string,
  certificateId: string,
  reason: string,
): Promise<{ error?: string }> {
  const { user, event } = await requireEventOwner(eventId);
  const parsed = revokeReasonSchema.safeParse(reason);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const result = await revokeCertificate({
    eventId: event.id,
    certificateId,
    actorId: user.id,
    reason: parsed.data,
  });
  if (!result.ok) {
    return { error: result.reason === "NOT_FOUND" ? "Sertifikat tidak ditemukan." : "Sertifikat ini sudah dicabut." };
  }

  revalidateCertificate(event.id);
  return {};
}
