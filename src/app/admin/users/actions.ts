"use server";

import { revalidatePath } from "next/cache";

import { disableReasonSchema } from "@/lib/validation/event-disable";
import { requireAdmin } from "@/server/authz";
import { disableUser, enableUser } from "@/server/admin-users";

export type DisableUserState = {
  error?: string;
  done?: boolean;
  values?: { reason: string };
};

const DISABLE_ERRORS = {
  NOT_FOUND: "Pengguna tidak ditemukan.",
  SELF: "Kamu tidak bisa menonaktifkan akunmu sendiri.",
  ADMIN_TARGET: "Akun admin tidak bisa dinonaktifkan dari panel ini.",
  ALREADY_DISABLED: "Pengguna ini sudah dinonaktifkan.",
} as const;

function revalidateUser(userId: string) {
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
}

export async function disableUserAction(
  userId: string,
  _prev: DisableUserState,
  formData: FormData,
): Promise<DisableUserState> {
  const admin = await requireAdmin();
  const values = { reason: String(formData.get("reason") ?? "") };
  const parsed = disableReasonSchema.safeParse(values.reason);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, values };

  const result = await disableUser({ userId, actorId: admin.id, reason: parsed.data });
  if (!result.ok) return { error: DISABLE_ERRORS[result.reason], values };

  revalidateUser(userId);
  return { done: true };
}

export async function enableUserAction(userId: string): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  const result = await enableUser({ userId, actorId: admin.id });
  if (!result.ok) {
    return { error: result.reason === "NOT_FOUND" ? "Pengguna tidak ditemukan." : "Pengguna ini tidak sedang dinonaktifkan." };
  }

  revalidateUser(userId);
  return {};
}
