"use server";

import { redirect } from "next/navigation";

import { runLoggedAction } from "@/actions/_lib/handle-action-error";
import { TERMS_VERSION } from "@/lib/legal";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { getSession } from "@/lib/session";
import { prisma } from "@/server/db";

export async function acceptTerms(formData: FormData) {
  return runLoggedAction("action.acceptTerms", async () => {
    const session = await getSession();
    if (!session) redirect("/login");
    if (session.user.disabledAt) redirect("/login?error=disabled");

    await prisma.user.update({
      where: { id: session.user.id },
      data: { termsVersion: TERMS_VERSION, termsAcceptedAt: new Date() },
    });

    redirect(safeRedirectPath(formData.get("next")));
  });
}
