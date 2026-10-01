import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { env } from "@/lib/env";
import { prisma } from "@/server/db";

const ERROR_LOG_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), env.CRON_SECRET)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.$queryRaw`SELECT 1`;
  const { count: deletedErrorLogs } = await prisma.errorLog.deleteMany({
    where: { lastSeenAt: { lt: new Date(Date.now() - ERROR_LOG_RETENTION_MS) } },
  });

  return Response.json({ ok: true, deletedErrorLogs });
}
