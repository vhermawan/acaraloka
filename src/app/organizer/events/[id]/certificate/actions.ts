"use server";

import { revalidatePath } from "next/cache";

import { certificateLayoutSchema } from "@/lib/certificate-layout";
import { requireEventOwner } from "@/server/authz";
import { saveCertificateLayout } from "@/server/certificate-config";

export async function saveLayout(eventId: string, layout: unknown): Promise<{ error?: string }> {
  const { event } = await requireEventOwner(eventId);
  const parsed = certificateLayoutSchema.safeParse(layout);
  if (!parsed.success) return { error: "Posisi elemen tidak valid. Muat ulang halaman lalu coba lagi." };

  const saved = await saveCertificateLayout(event.id, parsed.data);
  if (!saved) return { error: "Desain sudah terkunci karena penandatangan sudah menyetujui." };

  revalidatePath(`/organizer/events/${event.id}/certificate`);
  return {};
}
