"use server";

import { revalidatePath } from "next/cache";

import { formFieldSchema } from "@/lib/validation/form-field";
import { requireEventOwner } from "@/server/authz";
import { prisma } from "@/server/db";

export type FormFieldState = {
  errors?: Partial<Record<"label" | "type" | "options", string[]>>;
  message?: string;
  values?: Record<string, string>;
  savedAt?: number;
};

const EDITABLE_STATUSES = new Set(["DRAFT", "PUBLISHED"]);

function readForm(formData: FormData) {
  return {
    label: String(formData.get("label") ?? ""),
    type: String(formData.get("type") ?? ""),
    options: String(formData.get("options") ?? ""),
    required: formData.get("required") === "on",
  };
}

function toValues(input: ReturnType<typeof readForm>) {
  return { ...input, required: input.required ? "on" : "" };
}

export async function createFormField(
  eventId: string,
  _prev: FormFieldState,
  formData: FormData,
): Promise<FormFieldState> {
  const { event } = await requireEventOwner(eventId);
  const input = readForm(formData);
  if (!EDITABLE_STATUSES.has(event.status)) return { message: "Formulir acara ini tidak bisa diubah.", values: toValues(input) };

  const parsed = formFieldSchema.safeParse(input);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values: toValues(input) };

  const last = await prisma.formField.findFirst({ where: { eventId: event.id }, orderBy: { order: "desc" } });
  await prisma.formField.create({ data: { ...parsed.data, eventId: event.id, order: (last?.order ?? -1) + 1 } });
  revalidatePath(`/organizer/events/${event.id}/form`);
  return { savedAt: Date.now() };
}

export async function updateFormField(
  eventId: string,
  fieldId: string,
  _prev: FormFieldState,
  formData: FormData,
): Promise<FormFieldState> {
  const { event } = await requireEventOwner(eventId);
  const input = readForm(formData);
  if (!EDITABLE_STATUSES.has(event.status)) return { message: "Formulir acara ini tidak bisa diubah.", values: toValues(input) };

  const parsed = formFieldSchema.safeParse(input);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values: toValues(input) };

  await prisma.formField.updateMany({ where: { id: fieldId, eventId: event.id }, data: parsed.data });
  revalidatePath(`/organizer/events/${event.id}/form`);
  return { values: toValues(input), savedAt: Date.now() };
}

export async function deleteFormField(eventId: string, fieldId: string): Promise<void> {
  const { event } = await requireEventOwner(eventId);
  if (!EDITABLE_STATUSES.has(event.status)) return;

  await prisma.formField.deleteMany({ where: { id: fieldId, eventId: event.id } });
  revalidatePath(`/organizer/events/${event.id}/form`);
}

export async function moveFormField(eventId: string, fieldId: string, direction: "up" | "down"): Promise<void> {
  const { event } = await requireEventOwner(eventId);
  if (!EDITABLE_STATUSES.has(event.status)) return;

  const fields = await prisma.formField.findMany({ where: { eventId: event.id }, orderBy: { order: "asc" } });
  const index = fields.findIndex((field) => field.id === fieldId);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || targetIndex < 0 || targetIndex >= fields.length) return;

  const reordered = [...fields];
  [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
  await prisma.$transaction(
    reordered.map((field, order) => prisma.formField.update({ where: { id: field.id }, data: { order } })),
  );
  revalidatePath(`/organizer/events/${event.id}/form`);
}
