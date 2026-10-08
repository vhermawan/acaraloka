"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getPublishIssues } from "@/lib/event-publish";
import { createEventSlug } from "@/lib/slug";
import { cancelEventSchema } from "@/lib/validation/cancellation";
import {
  POSTER_CONTENT_TYPES,
  eventFormSchema,
  validatePosterFile,
  type PosterContentType,
} from "@/lib/validation/event";
import { requireEventOwner, requireOrganizer } from "@/server/authz";
import { cancelEvent } from "@/server/cancellation";
import { prisma } from "@/server/db";
import { POSTER_BUCKET, createSignedUploadUrl, removeObjects } from "@/server/storage";

type EventField = "title" | "description" | "timezone" | "startAt" | "endAt" | "venue";

export type EventFormState = {
  errors?: Partial<Record<EventField, string[]>>;
  message?: string;
  values?: Record<string, string>;
  savedAt?: number;
};

const EDITABLE_STATUSES = new Set(["DRAFT", "PUBLISHED"]);

function readEventForm(formData: FormData) {
  const fields: EventField[] = ["title", "description", "timezone", "startAt", "endAt", "venue"];
  return Object.fromEntries(fields.map((field) => [field, String(formData.get(field) ?? "")]));
}

export async function createEvent(_prev: EventFormState, formData: FormData): Promise<EventFormState> {
  const { user } = await requireOrganizer();
  const values = readEventForm(formData);
  const parsed = eventFormSchema.safeParse(values);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values };

  const event = await prisma.event.create({
    data: { ...parsed.data, organizerId: user.id, slug: createEventSlug(parsed.data.title) },
  });

  redirect(`/organizer/events/${event.id}`);
}

export async function updateEvent(
  eventId: string,
  _prev: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const { event } = await requireEventOwner(eventId);
  const values = readEventForm(formData);
  if (!EDITABLE_STATUSES.has(event.status)) {
    return { message: "Acara yang sudah dibatalkan atau dinonaktifkan tidak bisa diubah.", values };
  }

  const parsed = eventFormSchema.safeParse(values);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values };

  await prisma.event.update({ where: { id: event.id }, data: parsed.data });
  revalidatePath(`/organizer/events/${event.id}`);
  return { values, savedAt: Date.now() };
}

export async function deleteEvent(eventId: string): Promise<{ error?: string }> {
  const { event } = await requireEventOwner(eventId);
  if (event.status !== "DRAFT") return { error: "Hanya acara draf yang bisa dihapus." };

  await prisma.event.delete({ where: { id: event.id } });
  if (event.posterPath) await removeObjects(POSTER_BUCKET, [event.posterPath]).catch(() => undefined);

  redirect("/organizer");
}

export async function createPosterUpload(
  eventId: string,
  file: { contentType: string; size: number },
): Promise<{ uploadUrl: string; path: string } | { error: string }> {
  const { event } = await requireEventOwner(eventId);
  if (!EDITABLE_STATUSES.has(event.status)) return { error: "Poster acara ini tidak bisa diubah." };

  const invalid = validatePosterFile(file.contentType, file.size);
  if (invalid) return { error: invalid };

  const extension = POSTER_CONTENT_TYPES[file.contentType as PosterContentType];
  const path = `events/${event.id}/${randomBytes(8).toString("hex")}.${extension}`;
  const uploadUrl = await createSignedUploadUrl(POSTER_BUCKET, path);
  return { uploadUrl, path };
}

export async function setEventPoster(eventId: string, path: string): Promise<{ error?: string }> {
  const { event } = await requireEventOwner(eventId);
  if (!EDITABLE_STATUSES.has(event.status)) return { error: "Poster acara ini tidak bisa diubah." };
  if (!path.startsWith(`events/${event.id}/`) || path.includes("..")) return { error: "Berkas poster tidak valid." };

  await prisma.event.update({ where: { id: event.id }, data: { posterPath: path } });
  if (event.posterPath && event.posterPath !== path) {
    await removeObjects(POSTER_BUCKET, [event.posterPath]).catch(() => undefined);
  }
  revalidatePath(`/organizer/events/${event.id}`);
  return {};
}

export async function publishEvent(eventId: string): Promise<{ error?: string }> {
  const { event } = await requireEventOwner(eventId);
  const ticketTypeCount = await prisma.ticketType.count({ where: { eventId: event.id } });
  const issues = getPublishIssues({ ...event, ticketTypeCount });
  if (issues.length > 0) return { error: issues.join(" ") };

  const updated = await prisma.event.updateMany({
    where: { id: event.id, status: "DRAFT" },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });
  if (updated.count === 0) return { error: "Acara sudah tidak berstatus draf." };

  revalidatePath(`/organizer/events/${event.id}`, "layout");
  revalidatePath(`/e/${event.slug}`);
  return {};
}

export type CancelEventState = {
  errors?: Partial<Record<"reason" | "confirmTitle", string[]>>;
  message?: string;
  values?: Record<string, string>;
};

export async function cancelEventAction(
  eventId: string,
  _prev: CancelEventState,
  formData: FormData,
): Promise<CancelEventState> {
  const { event } = await requireEventOwner(eventId);
  const values = {
    reason: String(formData.get("reason") ?? ""),
    confirmTitle: String(formData.get("confirmTitle") ?? ""),
  };
  const parsed = cancelEventSchema(event.title).safeParse(values);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values };

  const cancelled = await cancelEvent({ eventId: event.id, reason: parsed.data.reason });
  if (!cancelled) return { message: "Hanya acara terbit yang belum dimulai yang bisa dibatalkan.", values };

  revalidatePath(`/organizer/events/${event.id}`, "layout");
  revalidatePath(`/e/${event.slug}`);
  revalidatePath("/me/tickets", "layout");
  redirect(`/organizer/events/${event.id}`);
}
