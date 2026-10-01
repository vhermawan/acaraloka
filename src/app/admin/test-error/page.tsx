import { requireAdmin } from "@/server/authz";

export default async function AdminTestErrorPage() {
  await requireAdmin();
  throw new Error(`Admin test error ${Date.now()}`);
}
