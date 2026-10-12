"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ACTION_ERROR_MESSAGE, ACTION_FAILED, runAction } from "@/actions/_lib/handle-action-error";
import { addAiAllowlist, removeAiAllowlist } from "@/server/ai-allowlist";
import { requireAdmin } from "@/server/authz";

export type AiAllowlistState = { error?: string; done?: boolean; values?: { email: string } };

const emailSchema = z.string().trim().toLowerCase().email("Email tidak valid.");

const ADD_ERRORS = {
  NOT_ORGANIZER: "Akun dengan email ini belum terdaftar sebagai panitia.",
  ALREADY_ALLOWED: "Akun ini sudah ada di daftar akses AI.",
} as const;

export async function addAiAllowlistAction(_prev: AiAllowlistState, formData: FormData): Promise<AiAllowlistState> {
  const values = { email: String(formData.get("email") ?? "") };
  return runAction("action.addAiAllowlistAction", { error: ACTION_ERROR_MESSAGE, values }, async () => {
    const admin = await requireAdmin();
    const parsed = emailSchema.safeParse(values.email);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message, values };

    const result = await addAiAllowlist({ email: parsed.data, actorId: admin.id });
    if (!result.ok) return { error: ADD_ERRORS[result.reason], values };

    revalidatePath("/admin/ai");
    return { done: true };
  });
}

export async function removeAiAllowlistAction(userId: string): Promise<{ error?: string }> {
  return runAction("action.removeAiAllowlistAction", ACTION_FAILED, async () => {
    const admin = await requireAdmin();
    const result = await removeAiAllowlist({ userId, actorId: admin.id });
    if (!result.ok) return { error: "Akun ini tidak ada di daftar akses AI." };

    revalidatePath("/admin/ai");
    return {};
  });
}
