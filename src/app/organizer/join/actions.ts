"use server";

import { redirect } from "next/navigation";

import { organizerProfileSchema } from "@/lib/validation/organizer";
import { requireUser } from "@/server/authz";
import { prisma } from "@/server/db";

export type JoinOrganizerState = {
  errors?: Partial<Record<"orgName" | "contactPhone" | "contactEmail", string[]>>;
  values?: Record<string, string>;
};

export async function joinOrganizer(
  _prev: JoinOrganizerState,
  formData: FormData,
): Promise<JoinOrganizerState> {
  const user = await requireUser();

  const values = {
    orgName: String(formData.get("orgName") ?? ""),
    contactPhone: String(formData.get("contactPhone") ?? ""),
    contactEmail: String(formData.get("contactEmail") ?? ""),
  };
  const parsed = organizerProfileSchema.safeParse(values);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values };
  }

  await prisma.organizerProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...parsed.data },
    update: {},
  });

  redirect("/organizer");
}
