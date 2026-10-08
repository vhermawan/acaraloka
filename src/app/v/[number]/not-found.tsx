import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { APP_NAME } from "@/lib/brand";

export default function CertificateNotFound() {
  return (
    <Container className="flex max-w-2xl flex-col items-start gap-3 py-12">
      <Badge variant="outline">Nomor tidak terdaftar di {APP_NAME}</Badge>
      <h1 className="text-balance text-2xl font-semibold tracking-tight">Verifikasi sertifikat</h1>
      <p className="text-sm text-muted-foreground">
        Periksa kembali nomor sertifikat, lalu coba lagi. Nomor ada di bagian bawah sertifikat atau di kode QR-nya.
      </p>
    </Container>
  );
}
