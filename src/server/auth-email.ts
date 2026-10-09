import "server-only";

import {
  accountExistsEmail,
  resetPasswordEmail,
  verifyEmail,
} from "@/lib/email-notifications";
import type { OutboxItem } from "@/lib/email-outbox";
import { loginPathFor, parseRole } from "@/lib/roles";
import { prisma } from "@/server/db";
import { enqueueEmails } from "@/server/email-outbox";
import { scheduleEmailDrain } from "@/server/email-schedule";

type AuthUser = { id: string; name: string; email: string; role?: unknown };

async function queue(item: OutboxItem) {
  await enqueueEmails(prisma, [item]);
  scheduleEmailDrain({ urgent: true });
}

async function hasPassword(userId: string) {
  const account = await prisma.account.findFirst({
    where: { userId, providerId: "credential", password: { not: null } },
    select: { id: true },
  });
  return account !== null;
}

export async function sendVerificationEmail({ user, url }: { user: AuthUser; url: string }) {
  await queue(verifyEmail(user, url));
}

export async function sendResetPassword({ user, url }: { user: AuthUser; url: string }) {
  if (await hasPassword(user.id)) {
    await queue(resetPasswordEmail(user, url));
    return;
  }
  await queue(
    accountExistsEmail(user, {
      reason: "reset",
      method: "google",
      loginPath: loginPathFor(parseRole(user.role)),
    }),
  );
}

export async function sendAccountExists({ user }: { user: AuthUser }) {
  const method = (await hasPassword(user.id)) ? "password" : "google";
  await queue(accountExistsEmail(user, { reason: "signup", method, loginPath: loginPathFor(parseRole(user.role)) }));
}

export async function markEmailVerified(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { emailVerified: true } });
}

export async function discardUnverifiedPasswordSignUp(email: string) {
  await prisma.user.deleteMany({
    where: {
      email,
      emailVerified: false,
      disabledAt: null,
      accounts: { every: { providerId: "credential" } },
    },
  });
}
