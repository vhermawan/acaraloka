"use client";

import { useActionState, useEffect, useState } from "react";
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
import { EVENT_TIMEZONES, timezoneLabel } from "@/lib/timezone";

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
  const [timezone, setTimezone] = useState(values.timezone);
  const [startAt, setStartAt] = useState(values.startAt);

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
          <Field data-invalid={!!errors.timezone}>
            <FieldLabel htmlFor="timezone">Zona waktu</FieldLabel>
            <NativeSelect id="timezone" name="timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)}>
              {EVENT_TIMEZONES.map((tz) => (
                <option key={tz.id} value={tz.id}>
                  {tz.label} ({tz.id})
                </option>
              ))}
            </NativeSelect>
            <FieldError errors={toErrors(errors.timezone)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={!!errors.startAt}>
              <FieldLabel htmlFor="startAt">Mulai</FieldLabel>
              <DateTimePicker
                id="startAt"
                name="startAt"
                defaultValue={values.startAt}
                timezone={timezone}
                zoneLabel={timezoneLabel(timezone)}
                invalid={!!errors.startAt}
                onValueChange={setStartAt}
              />
              <FieldError errors={toErrors(errors.startAt)} />
            </Field>
            <Field data-invalid={!!errors.endAt}>
              <FieldLabel htmlFor="endAt">Selesai</FieldLabel>
              <DateTimePicker
                id="endAt"
                name="endAt"
                defaultValue={values.endAt}
                timezone={timezone}
                zoneLabel={timezoneLabel(timezone)}
                invalid={!!errors.endAt}
                rangeStart={startAt}
              />
              <FieldError errors={toErrors(errors.endAt)} />
            </Field>
          </div>
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
