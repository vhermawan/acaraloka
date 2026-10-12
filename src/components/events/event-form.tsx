"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { Controller, useWatch } from "react-hook-form";
import { toast } from "sonner";

import type { EventFormState } from "@/actions/organizer-events";
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
import { PlaceSearch } from "@/components/events/place-search";
import { LOCATION_TYPE_LABELS, LOCATION_TYPES, hasOnlineMeeting, hasPhysicalVenue, type LocationType } from "@/lib/event-location";
import { EVENT_TIMEZONES, timezoneLabel, type EventTimezone } from "@/lib/timezone";
import { eventFormSchema } from "@/lib/validation/event";

type EventFormValues = {
  title: string;
  description: string;
  timezone: string;
  startAt: string;
  endAt: string;
  locationType: string;
  venueName: string;
  venueAddress: string;
  placeId: string;
  onlineUrl: string;
};

type EventFormProps = {
  action: (state: EventFormState, formData: FormData) => Promise<EventFormState>;
  defaultValues?: EventFormValues;
  submitLabel: string;
  disabled?: boolean;
  cancelHref?: string;
  placesEnabled?: boolean;
};

const EMPTY: EventFormValues = {
  title: "",
  description: "",
  timezone: "Asia/Jakarta",
  startAt: "",
  endAt: "",
  locationType: "OFFLINE",
  venueName: "",
  venueAddress: "",
  placeId: "",
  onlineUrl: "",
};

function EventForm({ action, defaultValues = EMPTY, submitLabel, disabled, cancelHref, placesEnabled = false }: EventFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const {
    form: {
      register,
      control,
      setValue,
      formState: { errors },
    },
    onSubmit,
  } = useActionForm(eventFormSchema, {
    defaultValues: {
      ...defaultValues,
      timezone: defaultValues.timezone as EventTimezone,
      locationType: defaultValues.locationType as LocationType,
    },
    dispatch: formAction,
    serverErrors: state.errors,
  });
  const timezone = useWatch({ control, name: "timezone" });
  const startAt = useWatch({ control, name: "startAt" });
  const locationType = useWatch({ control, name: "locationType" });
  const placeId = useWatch({ control, name: "placeId" });
  const showVenue = hasPhysicalVenue(locationType);
  const showOnline = hasOnlineMeeting(locationType);

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
          <Field data-invalid={!!errors.locationType}>
            <FieldLabel htmlFor="locationType">Jenis lokasi</FieldLabel>
            <NativeSelect
              id="locationType"
              aria-invalid={!!errors.locationType}
              className="h-10"
              {...register("locationType")}
            >
              {LOCATION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {LOCATION_TYPE_LABELS[type]}
                </option>
              ))}
            </NativeSelect>
            <FieldError errors={[errors.locationType]} />
          </Field>
          {showVenue ? (
            <fieldset className="flex flex-col gap-4 rounded-lg border border-border p-4">
              <legend className="px-1 text-sm font-medium">Tempat acara</legend>
              {placesEnabled ? (
                <PlaceSearch
                  onPick={(place) => {
                    setValue("placeId", place.placeId, { shouldDirty: true });
                    setValue("venueName", place.name, { shouldDirty: true, shouldValidate: true });
                    setValue("venueAddress", place.address, { shouldDirty: true, shouldValidate: true });
                  }}
                />
              ) : null}
              <input type="hidden" {...register("placeId")} />
              {placeId ? (
                <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                  <span>Terhubung ke hasil pencarian Google Maps. Peta ditampilkan di halaman acara.</span>
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0"
                    onClick={() => setValue("placeId", "", { shouldDirty: true })}
                  >
                    Lepas
                  </Button>
                </p>
              ) : null}
              <Field data-invalid={!!errors.venueName}>
                <FieldLabel htmlFor="venueName">Nama tempat</FieldLabel>
                <Input
                  id="venueName"
                  placeholder="Contoh: Aula Gedung Sate"
                  aria-invalid={!!errors.venueName}
                  className="h-10"
                  {...register("venueName", { onChange: () => setValue("placeId", "", { shouldDirty: true }) })}
                />
                <FieldError errors={[errors.venueName]} />
              </Field>
              <Field data-invalid={!!errors.venueAddress}>
                <FieldLabel htmlFor="venueAddress">Alamat</FieldLabel>
                <Input
                  id="venueAddress"
                  placeholder="Contoh: Jl. Diponegoro No. 22, Bandung"
                  aria-invalid={!!errors.venueAddress}
                  className="h-10"
                  {...register("venueAddress")}
                />
                <FieldDescription>
                  {placesEnabled
                    ? "Terisi otomatis dari hasil pencarian, dan bisa kamu ubah."
                    : "Peta tampil di halaman acara bila tempat dipilih lewat pencarian."}
                </FieldDescription>
                <FieldError errors={[errors.venueAddress]} />
              </Field>
            </fieldset>
          ) : null}
          {showOnline ? (
            <Field data-invalid={!!errors.onlineUrl}>
              <FieldLabel htmlFor="onlineUrl">Tautan meeting</FieldLabel>
              <Input
                id="onlineUrl"
                type="url"
                inputMode="url"
                placeholder="https://zoom.us/j/123456789"
                aria-invalid={!!errors.onlineUrl}
                className="h-10"
                {...register("onlineUrl")}
              />
              <FieldDescription>
                Hanya terlihat oleh peserta yang terkonfirmasi dan panitia. Zoom, Google Meet, Teams, YouTube, atau tautan lain.
              </FieldDescription>
              <FieldError errors={[errors.onlineUrl]} />
            </Field>
          ) : null}
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
