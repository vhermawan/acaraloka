import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { OUTBOX_RETENTION_MS } from "@/lib/email-outbox";
import { env } from "@/lib/env";
import { prisma } from "@/server/db";
import { purgeAiArtifacts } from "@/server/ai/purge";
import { drainOutbox, purgeOldOutbox } from "@/server/email-outbox";
import { reportCleanupFailure } from "@/server/storage-cleanup";

export const maxDuration = 300;

const ERROR_LOG_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), env.CRON_SECRET)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.$queryRaw`SELECT 1`;
  const { count: deletedErrorLogs } = await prisma.errorLog.deleteMany({
    where: { lastSeenAt: { lt: new Date(Date.now() - ERROR_LOG_RETENTION_MS) } },
  });
  const deletedEmails = await purgeOldOutbox(prisma, new Date(Date.now() - OUTBOX_RETENTION_MS));
  const email = env.EMAIL_ENABLED ? await drainOutbox() : null;

  const ai = await purgeAiArtifacts(prisma).catch(async (error) => {
    await reportCleanupFailure("cron.daily.ai", error, {});
    return null;
  });

  return Response.json({ ok: true, deletedErrorLogs, deletedEmails, email, ai });
}
