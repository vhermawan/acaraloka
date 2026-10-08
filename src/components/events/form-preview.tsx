type PreviewField = {
  id: string;
  label: string;
  type: string;
  required: boolean;
  options: string[];
};

const FIXED_FIELDS = ["Nama lengkap", "Email", "Nomor HP"];

function PreviewLabel({ label, required }: { label: string; required: boolean }) {
  return (
    <span className="text-sm font-medium">
      {label}
      {required ? null : <span className="font-normal text-muted-foreground"> (opsional)</span>}
    </span>
  );
}

function PreviewBox({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex h-9 items-center rounded-lg border border-input bg-background px-3 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function FormPreview({ fields }: { fields: PreviewField[] }) {
  return (
    <section aria-labelledby="preview-heading" className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 id="preview-heading" className="text-sm font-semibold">
          Pratinjau peserta
        </h2>
        <p className="text-xs text-muted-foreground">Tampilan formulir di halaman pendaftaran.</p>
      </div>
      <div inert className="flex flex-col gap-4 rounded-xl border border-border bg-muted/40 p-4">
        {FIXED_FIELDS.map((label) => (
          <div key={label} className="flex flex-col gap-1.5">
            <PreviewLabel label={label} required />
            <PreviewBox />
          </div>
        ))}
        {fields.map((field) => (
          <div key={field.id} className="flex flex-col gap-1.5">
            <PreviewLabel label={field.label} required={field.required} />
            {field.type === "SINGLE_CHOICE" ? (
              <ul className="flex flex-col gap-1.5">
                {field.options.map((option) => (
                  <li key={option} className="flex items-center gap-2 text-sm">
                    <span aria-hidden="true" className="size-4 shrink-0 rounded-full border border-input bg-background" />
                    {option}
                  </li>
                ))}
              </ul>
            ) : field.type === "DROPDOWN" ? (
              <PreviewBox>Pilih</PreviewBox>
            ) : (
              <PreviewBox />
            )}
          </div>
        ))}
        <div className="flex h-9 items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground">
          Daftar
        </div>
      </div>
    </section>
  );
}

export { FormPreview, type PreviewField };
