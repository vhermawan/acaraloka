"use client";

import { LoaderCircle, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import type { AiStartState } from "@/app/organizer/events/[id]/certificate/ai/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useActionForm } from "@/hooks/use-action-form";
import { AI_QUOTA } from "@/lib/ai-config";
import { AI_NOTE_MAX_LENGTH, generateInputSchema, type StoredInput } from "@/lib/ai/generate-input";
import { STYLE_KEYS, STYLE_LABELS } from "@/lib/ai/styles";
import { ACCENT_COLORS } from "@/lib/certificate-layout";
import { cn } from "cn";

type AiFormProps = {
  formId: string;
  defaults: StoredInput;
  dispatch: (formData: FormData) => void;
  pending: boolean;
  disabled: boolean;
  serverErrors: AiStartState["errors"];
  eventRemaining: number;
  dayRemaining: number;
  hasResults: boolean;
  logoField: ReactNode;
};

function AiForm({
  formId,
  defaults,
  dispatch,
  pending,
  disabled,
  serverErrors,
  eventRemaining,
  dayRemaining,
  hasResults,
  logoField,
}: AiFormProps) {
  const {
    form: {
      register,
      setValue,
      watch,
      formState: { errors },
    },
    onSubmit,
  } = useActionForm(generateInputSchema, {
    defaultValues: { style: defaults.style, colorHex: defaults.colorHex ?? "", note: defaults.note },
    dispatch,
    serverErrors,
  });
  const color = watch("colorHex");
  const noteLength = watch("note").length;

  return (
    <form id={formId} onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2" disabled={disabled}>
        <legend className="text-sm font-medium">Gaya</legend>
        <div className="flex flex-wrap gap-2">
          {STYLE_KEYS.map((key) => (
            <label
              key={key}
              className={cn(
                "flex h-10 cursor-pointer items-center rounded-lg border border-border px-3 text-sm font-medium transition-colors",
                "has-checked:border-primary has-checked:bg-primary/8 has-checked:text-primary",
                "has-focus-visible:ring-3 has-focus-visible:ring-ring/50 has-disabled:cursor-not-allowed has-disabled:opacity-50",
              )}
            >
              <input type="radio" value={key} className="sr-only" {...register("style")} />
              {STYLE_LABELS[key]}
            </label>
          ))}
        </div>
        <FieldError errors={[errors.style]} />
      </fieldset>

      <Field data-invalid={!!errors.colorHex}>
        <FieldLabel htmlFor="ai-color">Warna utama (opsional)</FieldLabel>
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(ACCENT_COLORS).map(([key, accent]) => (
            <button
              key={key}
              type="button"
              disabled={disabled}
              aria-label={accent.label}
              aria-pressed={color.toLowerCase() === accent.hex}
              onClick={() => setValue("colorHex", accent.hex, { shouldDirty: true, shouldValidate: true })}
              style={{ backgroundColor: accent.hex }}
              className={cn(
                "size-8 rounded-full border-2 border-background ring-1 ring-border transition disabled:opacity-50",
                "aria-pressed:ring-2 aria-pressed:ring-primary",
              )}
            />
          ))}
          <Input
            id="ai-color"
            placeholder="#166534"
            maxLength={7}
            autoComplete="off"
            aria-invalid={!!errors.colorHex}
            className="h-10 w-28 font-mono"
            disabled={disabled}
            {...register("colorHex")}
          />
          <Button
            type="button"
            variant="ghost"
            className="h-10 px-3"
            disabled={disabled || color === ""}
            onClick={() => setValue("colorHex", "", { shouldDirty: true, shouldValidate: true })}
          >
            Biarkan AI memilih
          </Button>
        </div>
        <FieldError errors={[errors.colorHex]} />
      </Field>

      {logoField}

      <Field data-invalid={!!errors.note}>
        <FieldLabel htmlFor="ai-note">Keterangan tambahan (opsional)</FieldLabel>
        <Textarea
          id="ai-note"
          rows={3}
          placeholder="Contoh: seminar kesehatan, nuansa daun dan hijau tua"
          aria-invalid={!!errors.note}
          aria-describedby="ai-note-hint"
          disabled={disabled}
          {...register("note")}
        />
        <p id="ai-note-hint" className="text-xs text-muted-foreground tabular-nums">
          {noteLength} dari {AI_NOTE_MAX_LENGTH} karakter. Judul, jenis, dan tanggal acara ikut otomatis.
        </p>
        <FieldError errors={[errors.note]} />
      </Field>

      <p className="text-sm text-muted-foreground">
        Nama, nomor, tanggal, tanda tangan, dan QR diisi otomatis oleh Acaraloka. AI hanya membuat latar dan tata letak.
      </p>

      <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground tabular-nums">
          Sisa {eventRemaining} dari {AI_QUOTA.perEventKind} percobaan untuk acara ini · sisa {dayRemaining} hari ini
        </p>
        <Button type="submit" className="h-10 w-fit gap-2 px-4" disabled={disabled || pending}>
          {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
          {pending ? "Memulai..." : hasResults ? "Buat ulang" : "Buat desain"}
        </Button>
      </div>
    </form>
  );
}

export { AiForm };
