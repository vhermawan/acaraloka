import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/layout/container";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RegistrationPreviewCard } from "@/components/home/registration-preview-card";
import { InteractionPreviewCard } from "@/components/home/interaction-preview-card";

export default function Home() {
  return (
    <Container className="flex flex-col gap-12 py-12">
      <section aria-labelledby="intro-heading" className="max-w-2xl">
        <h1
          id="intro-heading"
          className="text-3xl font-semibold tracking-tight text-foreground"
        >
          event-in
        </h1>
        <p className="mt-3 text-base text-muted-foreground">
          Membantu panitia mengelola pendaftaran, e-tiket QR, check-in, dan
          sertifikat bertanda tangan untuk seminar, workshop, dan meetup.
        </p>
      </section>

      <section aria-labelledby="status-heading" className="flex flex-col gap-3">
        <h2 id="status-heading" className="text-lg font-medium text-foreground">
          Kosakata status pendaftaran
        </h2>
        <div className="flex flex-wrap gap-2">
          <Badge>Terkonfirmasi</Badge>
          <Badge variant="secondary">Menunggu pembayaran</Badge>
          <Badge variant="destructive">Dibatalkan panitia</Badge>
        </div>
      </section>

      <section
        aria-labelledby="komponen-heading"
        className="grid gap-6 md:grid-cols-2"
      >
        <h2 id="komponen-heading" className="sr-only">
          Pratinjau komponen
        </h2>
        <RegistrationPreviewCard />
        <InteractionPreviewCard />
      </section>

      <section aria-labelledby="peserta-heading">
        <Card>
          <CardHeader>
            <CardTitle id="peserta-heading">Daftar peserta</CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tanggal daftar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="py-8 text-center whitespace-normal text-muted-foreground"
                >
                  Belum ada peserta terdaftar. Data akan muncul setelah
                  pendaftaran event dibuka.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      </section>
    </Container>
  );
}
