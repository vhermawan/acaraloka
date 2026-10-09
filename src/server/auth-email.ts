import "server-only";

import { AUTH_EMAILS_PER_ADDRESS_PER_HOUR } from "@/lib/auth-config";
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
  const recent = await prisma.emailOutbox.count({
    where: { to: item.to, template: item.template, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recent >= AUTH_EMAILS_PER_ADDRESS_PER_HOUR) return;
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
  const candidates = await prisma.user.findMany({
    where: {
      email,
      emailVerified: false,
      disabledAt: null,
      OR: [{ isAdmin: null }, { isAdmin: false }],
      accounts: { some: { providerId: "credential" }, none: { providerId: { not: "credential" } } },
      registrations: { none: {} },
      organizerProfile: null,
    },
    select: { id: true },
  });
  for (const { id } of candidates) {
    const audited = await prisma.auditLog.count({ where: { actorId: id } });
    if (audited > 0) continue;
    await prisma.user.deleteMany({ where: { id, emailVerified: false } }).catch(() => undefined);
  }
}
