import type { Metadata } from "next";

import { AdminNav } from "@/components/admin/admin-nav";
import { Container } from "@/components/layout/container";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { requireAdmin } from "@/server/authz";
import { prisma } from "@/server/db";

export const metadata: Metadata = {
  title: "Log error | Hadirly",
};

export default async function AdminLogsPage() {
  await requireAdmin();
  const logs = await prisma.errorLog.findMany({
    orderBy: { lastSeenAt: "desc" },
    take: 100,
  });

  return (
    <Container className="flex flex-col gap-8 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="text-balance text-2xl font-semibold tracking-tight">Log error</h1>
        <AdminNav />
      </header>
      {logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada error tercatat.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pesan</TableHead>
              <TableHead>Sumber</TableHead>
              <TableHead className="text-right">Jumlah</TableHead>
              <TableHead>Terakhir</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="max-w-md">
                  <details>
                    <summary className="cursor-pointer truncate">{log.message}</summary>
                    {log.stack ? (
                      <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap">
                        {log.stack}
                      </pre>
                    ) : null}
                  </details>
                </TableCell>
                <TableCell className="font-mono text-xs">{log.source}</TableCell>
                <TableCell className="text-right tabular-nums">{log.count}</TableCell>
                <TableCell className="whitespace-nowrap">{formatDateTime(log.lastSeenAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Container>
  );
}
