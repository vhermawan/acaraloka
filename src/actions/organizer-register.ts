"use server";

import { redirect } from "next/navigation";

import { ACTION_ERROR_MESSAGE, runAction } from "@/actions/_lib/handle-action-error";
import { ROLE_CONFLICT_MESSAGES, resolvePostLoginPath } from "@/lib/roles";
import { organizerProfileSchema } from "@/lib/validation/organizer";
import { requireUser } from "@/server/authz";
import { prisma } from "@/server/db";
import { setFlash } from "@/server/flash";

export type OrganizerRegisterState = {
  errors?: Partial<Record<"orgName" | "contactPhone" | "contactEmail", string[]>>;
  message?: string;
  values?: Record<string, string>;
};

export async function registerOrganizer(
  _prev: OrganizerRegisterState,
  formData: FormData,
): Promise<OrganizerRegisterState> {
  const values = {
    orgName: String(formData.get("orgName") ?? ""),
    contactPhone: String(formData.get("contactPhone") ?? ""),
    contactEmail: String(formData.get("contactEmail") ?? ""),
  };

  return runAction("action.registerOrganizer", { message: ACTION_ERROR_MESSAGE, values }, async () => {
    const user = await requireUser({ loginPath: "/organizer/login", next: "/organizer/register" });
    if (user.role !== "ORGANIZER") {
      return { message: ROLE_CONFLICT_MESSAGES["role-participant"] };
    }

    const parsed = organizerProfileSchema.safeParse(values);
    if (!parsed.success) {
      return { errors: parsed.error.flatten().fieldErrors, values };
    }

    await prisma.organizerProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...parsed.data },
      update: {},
    });

    await setFlash("organizer-created");
    redirect(resolvePostLoginPath("ORGANIZER", formData.get("next"), true));
  });
}
