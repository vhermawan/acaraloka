import { Container } from "@/components/layout/container";
import { certificateSerif } from "@/components/home/certificate-font";
import { cn } from "@/lib/utils";

const CHIPS = ["Formal kampus", "Minimalis", "Warna cerah", "Ada logo"];

const TEMPLATES = [
  { label: "Formal", surface: "bg-card", kicker: "text-foreground", rule: "bg-foreground" },
  { label: "Minimalis", surface: "bg-card", kicker: "text-muted-foreground", rule: "bg-neutral-400" },
  { label: "Cerah", surface: "bg-orange-50", kicker: "text-orange-700", rule: "bg-orange-700" },
];

function AiTemplate() {
  return (
    <section id="template" aria-labelledby="template-heading" className="scroll-mt-16 py-[72px] lg:py-[120px]">
      <Container className="max-w-[75rem]">
        <div className="grid gap-10 rounded-xl bg-card p-6 ring-1 ring-primary sm:p-10 lg:grid-cols-2 lg:gap-12">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex h-[22px] items-center rounded-full bg-primary/10 px-2.5 text-xs font-semibold text-primary">
                Segera hadir
              </span>
              <span className="text-[13px] font-semibold text-muted-foreground">template sertifikat</span>
            </div>
            <h2
              id="template-heading"
              className="text-[28px] leading-9 font-bold tracking-[-0.6px] text-balance text-foreground sm:text-[32px] sm:leading-10"
            >
              Tulis maunya, template sertifikat dibuatkan
            </h2>
            <p className="text-[17px] leading-7 text-pretty text-muted-foreground">
              Jelaskan gaya acara kamu, lalu pilih salah satu dari tiga rancangan. Posisi nama dan tanda tangan tetap bisa kamu
              geser sendiri.
            </p>
            <div aria-hidden="true" className="flex flex-col gap-3 rounded-lg bg-card p-4 ring-1 ring-border">
              <p className="text-[15px] leading-[26px] text-foreground">
                Sertifikat formal untuk workshop kampus, warna hijau tua, ada tempat logo himpunan di kiri atas.
              </p>
              <div className="flex flex-wrap gap-2">
                {CHIPS.map((chip) => (
                  <span key={chip} className="inline-flex h-7 items-center rounded-full bg-muted px-3 text-xs text-muted-foreground ring-1 ring-border">
                    {chip}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">Contoh permintaan</span>
                <span className="inline-flex h-9 items-center rounded-lg bg-primary/60 px-4 text-sm font-semibold text-primary-foreground">
                  Buat template
                </span>
              </div>
            </div>
          </div>

          <ul aria-label="Contoh hasil template" className="grid grid-cols-3 content-start gap-3 sm:gap-4">
            {TEMPLATES.map((template) => (
              <li key={template.label} className={cn("flex flex-col items-center gap-2.5 rounded-lg p-3 ring-1 ring-border sm:p-4", template.surface)}>
                <p aria-hidden="true" className={cn("text-[8px] font-bold tracking-[2px] sm:text-[9px]", template.kicker)}>
                  SERTIFIKAT
                </p>
                <span aria-hidden="true" className={cn("h-0.5 w-8", template.rule)} />
                <p aria-hidden="true" className={cn(certificateSerif.className, "text-sm font-semibold whitespace-nowrap text-foreground sm:text-lg")}>
                  Rina Pratama
                </p>
                <span aria-hidden="true" className="h-1 w-full rounded-full bg-black/5" />
                <span aria-hidden="true" className="h-1 w-full rounded-full bg-black/5" />
                <p className="text-xs text-neutral-600">{template.label}</p>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}

export { AiTemplate };
