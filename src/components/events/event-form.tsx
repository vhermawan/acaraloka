"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { Controller, useWatch } from "react-hook-form";
import { toast } from "sonner";

import type { EventFormState } from "@/app/organizer/events/actions";
import { DateTimePicker } from "@/components/events/date-time-picker";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useActionForm } from "@/hooks/use-action-form";
import { EVENT_TIMEZONES, timezoneLabel, type EventTimezone } from "@/lib/timezone";
import { eventFormSchema } from "@/lib/validation/event";

type EventFormValues = {
  title: string;
  description: string;
  timezone: string;
  startAt: string;
  endAt: string;
  venue: string;
};

type EventFormProps = {
  action: (state: EventFormState, formData: FormData) => Promise<EventFormState>;
  defaultValues?: EventFormValues;
  submitLabel: string;
  disabled?: boolean;
  cancelHref?: string;
};

const EMPTY: EventFormValues = {
  title: "",
  description: "",
  timezone: "Asia/Jakarta",
  startAt: "",
  endAt: "",
  venue: "",
};

function EventForm({ action, defaultValues = EMPTY, submitLabel, disabled, cancelHref }: EventFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const {
    form: {
      register,
      control,
      formState: { errors },
    },
    onSubmit,
  } = useActionForm(eventFormSchema, {
    defaultValues: { ...defaultValues, timezone: defaultValues.timezone as EventTimezone },
    dispatch: formAction,
    serverErrors: state.errors,
  });
  const timezone = useWatch({ control, name: "timezone" });
  const startAt = useWatch({ control, name: "startAt" });

  useEffect(() => {
    if (state.savedAt) toast.success("Perubahan disimpan.");
  }, [state.savedAt]);

  return (
    <form onSubmit={onSubmit} noValidate>
      <fieldset disabled={disabled || pending} className="contents">
        <FieldGroup>
          {state.message ? (
            <p role="alert" className="text-sm text-destructive">
              {state.message}
            </p>
          ) : null}
          <Field data-invalid={!!errors.title}>
            <FieldLabel htmlFor="title">Judul acara</FieldLabel>
            <Input
              id="title"
              placeholder="Contoh: Workshop Fotografi Produk untuk UMKM"
              aria-invalid={!!errors.title}
              className="h-10"
              {...register("title")}
            />
            <FieldError errors={[errors.title]} />
          </Field>
          <Field data-invalid={!!errors.description}>
            <FieldLabel htmlFor="description">Deskripsi</FieldLabel>
            <Textarea
              id="description"
              rows={6}
              placeholder="Tulis tujuan acara, susunan acara, dan siapa pembicaranya."
              aria-invalid={!!errors.description}
              {...register("description")}
            />
            <FieldDescription>Jelaskan isi acara, pembicara, dan siapa yang cocok ikut.</FieldDescription>
            <FieldError errors={[errors.description]} />
          </Field>
          <Field data-invalid={!!errors.timezone}>
            <FieldLabel htmlFor="timezone">Zona waktu</FieldLabel>
            <NativeSelect id="timezone" aria-invalid={!!errors.timezone} className="h-10" {...register("timezone")}>
              {EVENT_TIMEZONES.map((tz) => (
                <option key={tz.id} value={tz.id}>
                  {tz.label} ({tz.id})
                </option>
              ))}
            </NativeSelect>
            <FieldError errors={[errors.timezone]} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={!!errors.startAt}>
              <FieldLabel htmlFor="startAt">Mulai</FieldLabel>
              <Controller
                control={control}
                name="startAt"
                render={({ field }) => (
                  <DateTimePicker
                    id="startAt"
                    name={field.name}
                    defaultValue={field.value}
                    timezone={timezone}
                    zoneLabel={timezoneLabel(timezone)}
                    invalid={!!errors.startAt}
                    onValueChange={field.onChange}
                  />
                )}
              />
              <FieldError errors={[errors.startAt]} />
            </Field>
            <Field data-invalid={!!errors.endAt}>
              <FieldLabel htmlFor="endAt">Selesai</FieldLabel>
              <Controller
                control={control}
                name="endAt"
                render={({ field }) => (
                  <DateTimePicker
                    id="endAt"
                    name={field.name}
                    defaultValue={field.value}
                    timezone={timezone}
                    zoneLabel={timezoneLabel(timezone)}
                    invalid={!!errors.endAt}
                    rangeStart={startAt}
                    onValueChange={field.onChange}
                  />
                )}
              />
              <FieldError errors={[errors.endAt]} />
            </Field>
          </div>
          <Field data-invalid={!!errors.venue}>
            <FieldLabel htmlFor="venue">Lokasi</FieldLabel>
            <Input
              id="venue"
              placeholder="Contoh: Aula Gedung Sate, Bandung, atau tautan Zoom"
              aria-invalid={!!errors.venue}
              className="h-10"
              {...register("venue")}
            />
            <FieldDescription>Alamat tempat, atau tautan Zoom/Meet untuk acara online.</FieldDescription>
            <FieldError errors={[errors.venue]} />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" className="h-10 px-4">
              {pending ? "Menyimpan..." : submitLabel}
            </Button>
            {cancelHref ? (
              <Button variant="ghost" className="h-10 px-4" nativeButton={false} render={<Link href={cancelHref} />}>
                Batal
              </Button>
            ) : null}
          </div>
        </FieldGroup>
      </fieldset>
    </form>
  );
}

export { EventForm, type EventFormValues };
