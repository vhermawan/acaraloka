import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { getSession } from "@/lib/session";
import { hasAcceptedCurrentTerms } from "@/server/authz";

import { acceptTerms } from "./actions";

export const metadata: Metadata = {
  title: "Persetujuan",
};

export default async function AcceptTermsPage({ searchParams }: PageProps<"/legal/accept">) {
  const { next } = await searchParams;
  const nextPath = safeRedirectPath(next);

  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  if (hasAcceptedCurrentTerms(session.user)) redirect(nextPath);

  return (
    <Container className="flex justify-center py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">
            Syarat Layanan dan Kebijakan Privasi
          </CardTitle>
          <CardDescription>
            Sebelum lanjut, baca dan setujui dokumen berikut. Kami mencatat
            waktu dan versi persetujuanmu.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ul className="flex flex-col gap-1 text-sm">
            <li>
              <Link href="/legal/terms" className="underline underline-offset-4">
                Syarat Layanan
              </Link>
            </li>
            <li>
              <Link href="/legal/privacy" className="underline underline-offset-4">
                Kebijakan Privasi
              </Link>
            </li>
          </ul>
          <form action={acceptTerms}>
            <input type="hidden" name="next" value={nextPath} />
            <Button type="submit" size="lg" className="w-full">
              Saya setuju
            </Button>
          </form>
        </CardContent>
      </Card>
    </Container>
  );
}
