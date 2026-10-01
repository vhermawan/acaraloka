"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import type { EventFormState } from "@/app/organizer/events/actions";
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
import { EVENT_TIMEZONES } from "@/lib/timezone";

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
};

const EMPTY: EventFormValues = {
  title: "",
  description: "",
  timezone: "Asia/Jakarta",
  startAt: "",
  endAt: "",
  venue: "",
};

function toErrors(messages?: string[]) {
  return messages?.map((message) => ({ message }));
}

function EventForm({ action, defaultValues = EMPTY, submitLabel, disabled }: EventFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const values = { ...defaultValues, ...state.values };
  const errors = state.errors ?? {};

  useEffect(() => {
    if (state.savedAt) toast.success("Perubahan disimpan.");
  }, [state.savedAt]);

  return (
    <form action={formAction} noValidate>
      <fieldset disabled={disabled || pending} className="contents">
        <FieldGroup>
          {state.message ? (
            <p role="alert" className="text-sm text-destructive">
              {state.message}
            </p>
          ) : null}
          <Field data-invalid={!!errors.title}>
            <FieldLabel htmlFor="title">Judul acara</FieldLabel>
            <Input id="title" name="title" required defaultValue={values.title} aria-invalid={!!errors.title} />
            <FieldError errors={toErrors(errors.title)} />
          </Field>
          <Field data-invalid={!!errors.description}>
            <FieldLabel htmlFor="description">Deskripsi</FieldLabel>
            <Textarea
              id="description"
              name="description"
              required
              rows={6}
              defaultValue={values.description}
              aria-invalid={!!errors.description}
            />
            <FieldDescription>Jelaskan isi acara, pembicara, dan siapa yang cocok ikut.</FieldDescription>
            <FieldError errors={toErrors(errors.description)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={!!errors.startAt}>
              <FieldLabel htmlFor="startAt">Mulai</FieldLabel>
              <Input
                id="startAt"
                name="startAt"
                type="datetime-local"
                required
                defaultValue={values.startAt}
                aria-invalid={!!errors.startAt}
              />
              <FieldError errors={toErrors(errors.startAt)} />
            </Field>
            <Field data-invalid={!!errors.endAt}>
              <FieldLabel htmlFor="endAt">Selesai</FieldLabel>
              <Input
                id="endAt"
                name="endAt"
                type="datetime-local"
                required
                defaultValue={values.endAt}
                aria-invalid={!!errors.endAt}
              />
              <FieldError errors={toErrors(errors.endAt)} />
            </Field>
          </div>
          <Field data-invalid={!!errors.timezone}>
            <FieldLabel htmlFor="timezone">Zona waktu</FieldLabel>
            <NativeSelect id="timezone" name="timezone" defaultValue={values.timezone}>
              {EVENT_TIMEZONES.map((tz) => (
                <option key={tz.id} value={tz.id}>
                  {tz.label} ({tz.id})
                </option>
              ))}
            </NativeSelect>
            <FieldError errors={toErrors(errors.timezone)} />
          </Field>
          <Field data-invalid={!!errors.venue}>
            <FieldLabel htmlFor="venue">Lokasi</FieldLabel>
            <Input id="venue" name="venue" required defaultValue={values.venue} aria-invalid={!!errors.venue} />
            <FieldDescription>Alamat tempat, atau tautan Zoom/Meet untuk acara online.</FieldDescription>
            <FieldError errors={toErrors(errors.venue)} />
          </Field>
          <div>
            <Button type="submit" size="lg">
              {pending ? "Menyimpan..." : submitLabel}
            </Button>
          </div>
        </FieldGroup>
      </fieldset>
    </form>
  );
}

export { EventForm, type EventFormValues };
