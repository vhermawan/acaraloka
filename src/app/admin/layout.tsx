import { AdminShell } from "@/components/admin/admin-shell";
import { getSession } from "@/lib/session";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const session = await getSession();
  if (!session || session.user.role !== "ADMIN") return children;

  return (
    <AdminShell userName={session.user.name} userEmail={session.user.email}>
      {children}
    </AdminShell>
  );
}
