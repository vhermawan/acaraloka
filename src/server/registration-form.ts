import "server-only";

import type { RegistrationField } from "@/lib/validation/registration";
import { prisma } from "@/server/db";

function toOptions(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export async function getRegistrationFields(eventId: string): Promise<RegistrationField[]> {
  const fields = await prisma.formField.findMany({ where: { eventId }, orderBy: { order: "asc" } });
  return fields.map((field) => ({
    id: field.id,
    label: field.label,
    type: field.type,
    required: field.required,
    options: toOptions(field.options),
  }));
}
