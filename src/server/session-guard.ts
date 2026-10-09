import "server-only";
import { APIError } from "better-auth/api";

import { prisma } from "@/server/db";

type SessionContext = { path?: string } | null | undefined;

export async function rejectDisabledPasswordSignIn(session: { userId: string }, context: SessionContext) {
  if (context?.path !== "/sign-in/email") return;
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { disabledAt: true } });
  if (!user?.disabledAt) return;
  throw new APIError("FORBIDDEN", {
    code: "ACCOUNT_DISABLED",
    message: "Akun ini dinonaktifkan.",
  });
}
