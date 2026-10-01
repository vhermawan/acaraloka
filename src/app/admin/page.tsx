import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { requireAdmin } from "@/server/authz";

export const metadata: Metadata = {
  title: "Admin | event-in",
};

export default async function AdminPage() {
  await requireAdmin();

  return (
    <Container className="flex flex-col gap-8 py-12">
      <h1 className="text-balance text-2xl font-semibold tracking-tight">Admin</h1>
    </Container>
  );
}
