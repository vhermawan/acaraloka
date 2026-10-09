"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/server/authz";
import { runManualDrain } from "@/server/admin-email";

export type DrainQueueState = { error?: string; message?: string };

export async function drainQueueAction(): Promise<DrainQueueState> {
  const admin = await requireAdmin();
  const result = await runManualDrain({ actorId: admin.id });

  if (!result.ok) {
    const errors = {
      DISABLED: "Pengiriman email sedang dimatikan (EMAIL_ENABLED).",
      COOLDOWN: "Antrean baru saja diproses. Tunggu sekitar 30 detik.",
      FAILED: "Antrean gagal diproses. Cek log error.",
    } as const;
    return { error: errors[result.reason] };
  }

  revalidatePath("/admin/email");
  if (result.skipped) return { message: "Antrean sedang diproses oleh proses lain." };
  const parts = [`${result.sent} terkirim`, `${result.failed} gagal`, `${result.retrying} akan dicoba ulang`];
  return {
    message: `${parts.join(", ")}.${result.rateLimited ? " Dibatasi penyedia email, sisanya menunggu." : ""}`,
  };
}
