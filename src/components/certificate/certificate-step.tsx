import { cn } from "cn";

export type StepTone = "done" | "progress" | "todo";

const TONES: Record<StepTone, string> = {
  done: "bg-success/10 text-success",
  progress: "bg-[#CA8A04]/10 text-[#8A5A00] dark:text-[#FACC15]",
  todo: "bg-muted text-muted-foreground",
};

type CertificateStepProps = {
  id: string;
  number: string;
  title: string;
  status: { label: string; tone: StepTone };
  description?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
};

function CertificateStep({ id, number, title, status, description, aside, children }: CertificateStepProps) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-5 rounded-xl border border-border p-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span aria-hidden="true" className="font-mono text-sm/7 font-medium text-primary">
            {number}
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 id={id} className="text-lg/7 font-semibold">
                <span className="sr-only">Langkah {Number(number)}: </span>
                {title}
              </h2>
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", TONES[status.tone])}>{status.label}</span>
            </div>
            {description ? <div className="max-w-prose text-sm text-muted-foreground">{description}</div> : null}
          </div>
        </div>
        {aside ? <div className="shrink-0 sm:pl-0 pl-8">{aside}</div> : null}
      </header>
      {children}
    </section>
  );
}

export { CertificateStep };
