import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/home/section-heading";

const STEPS = [
  { title: "Buat acara", body: "Isi nama, tanggal, lokasi, dan kuota. Link pendaftaran langsung jadi." },
  { title: "Peserta daftar", body: "Mereka daftar dari HP dan langsung dapat e-tiket QR di menu Tiket Saya." },
  { title: "Scan di lokasi", body: "Panitia scan QR peserta. Layar langsung hijau, kuning, atau merah." },
  { title: "Terbitkan sertifikat", body: "Minta tanda tangan, lalu terbitkan sertifikat untuk peserta yang hadir." },
];

function HowItWorks() {
  return (
    <section id="cara-kerja" aria-labelledby="cara-kerja-heading" className="scroll-mt-16 py-18 lg:py-30">
      <Container className="flex max-w-300 flex-col gap-10 lg:gap-14">
        <SectionHeading
          id="cara-kerja-heading"
          eyebrow="cara kerja"
          title="Empat langkah, dari rencana sampai sertifikat"
          description="Semua dikerjakan di satu tempat, tanpa pindah-pindah aplikasi."
        />
        <ol className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex flex-col gap-3.5">
              <span className="font-mono text-[40px]/11 font-medium tracking-[-1px] text-primary" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="h-px w-full bg-border" aria-hidden="true" />
              <h3 className="text-xl/7 font-semibold tracking-[-0.2px] text-foreground">{step.title}</h3>
              <p className="text-[15px]/6.25 text-pretty text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

export { HowItWorks };
