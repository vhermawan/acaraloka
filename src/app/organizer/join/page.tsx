import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Container } from "@/components/layout/container";
import { JoinOrganizerForm } from "@/components/organizer/join-organizer-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/server/authz";
import { prisma } from "@/server/db";

export const metadata: Metadata = {
  title: "Jadi panitia | Hadirly",
};

export default async function JoinOrganizerPage() {
  const user = await requireUser();
  const existing = await prisma.organizerProfile.findUnique({
    where: { userId: user.id },
  });
  if (existing) redirect("/organizer");

  return (
    <Container className="flex justify-center py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Jadi panitia</CardTitle>
          <CardDescription>
            Isi data penyelenggara untuk mulai membuat acara. Kontak ini bisa
            dilihat peserta yang mendaftar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <JoinOrganizerForm defaultEmail={user.email} />
        </CardContent>
      </Card>
    </Container>
  );
}
