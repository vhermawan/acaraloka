"use server";

import { randomBytes } from "node:crypto";

import { after } from "next/server";
import { revalidatePath } from "next/cache";

import { AI_UNAVAILABLE_CODE, AI_UNAVAILABLE_MESSAGE } from "@/lib/ai-config";
import {
  AI_BLOCKLIST_MESSAGE,
  LOGO_CONTENT_TYPES,
  LOGO_INVALID_MESSAGE,
  LOGO_MAX_BYTES,
  generateInputSchema,
  toStoredInput,
} from "@/lib/ai/generate-input";
import { checkBlocklist } from "@/lib/ai/blocklist";
import { aiRawLogoPath } from "@/lib/ai/paths";
import { getAiAccess } from "@/server/ai-access";
import { reserveGeneration } from "@/server/ai-quota";
import { runGeneration } from "@/server/ai/generation-job";
import { finalizeLogoUpload } from "@/server/ai/logo";
import { IMAGE_PROMPT_VERSION } from "@/server/ai/prompts/image";
import { requireEventOwner } from "@/server/authz";
import { prisma } from "@/server/db";
import { AI_BUCKET, createSignedUploadUrl } from "@/server/storage";

export type AiStartState = {
  generationId?: string;
  code?: typeof AI_UNAVAILABLE_CODE;
  message?: string;
  errors?: Partial<Record<"style" | "colorHex" | "note", string[]>>;
  values?: Record<string, string>;
};

const UNAVAILABLE: AiStartState = { code: AI_UNAVAILABLE_CODE, message: AI_UNAVAILABLE_MESSAGE };

export async function createAiLogoUpload(
  eventId: string,
  file: { contentType: string; size: number },
): Promise<{ uploadUrl: string; path: string } | { error: string }> {
  const { user, event } = await requireEventOwner(eventId);
  const access = await getAiAccess(user, { eventId: event.id, kind: "CERTIFICATE" });
  if (access.status === "HIDDEN") return { error: AI_UNAVAILABLE_MESSAGE };

  if (!(file.contentType in LOGO_CONTENT_TYPES) || file.size <= 0 || file.size > LOGO_MAX_BYTES) {
    return { error: LOGO_INVALID_MESSAGE };
  }
  const extension = LOGO_CONTENT_TYPES[file.contentType as keyof typeof LOGO_CONTENT_TYPES];
  const path = aiRawLogoPath(event.id, randomBytes(8).toString("hex"), extension);
  const uploadUrl = await createSignedUploadUrl(AI_BUCKET, path);
  return { uploadUrl, path };
}

export async function finalizeAiLogo(eventId: string, rawPath: string): Promise<{ path: string } | { error: string }> {
  const { user, event } = await requireEventOwner(eventId);
  const access = await getAiAccess(user, { eventId: event.id, kind: "CERTIFICATE" });
  if (access.status === "HIDDEN") return { error: AI_UNAVAILABLE_MESSAGE };

  const result = await finalizeLogoUpload(event.id, rawPath);
  if (!result.ok) return { error: result.error };

  revalidatePath(`/organizer/events/${event.id}/certificate/ai`);
  return { path: result.path };
}

export async function startAiGeneration(
  eventId: string,
  _prev: AiStartState,
  formData: FormData,
): Promise<AiStartState> {
  const { user, event } = await requireEventOwner(eventId);
  const access = await getAiAccess(user, { eventId: event.id, kind: "CERTIFICATE" });
  if (access.status === "HIDDEN") return UNAVAILABLE;

  const values = {
    style: String(formData.get("style") ?? ""),
    colorHex: String(formData.get("colorHex") ?? ""),
    note: String(formData.get("note") ?? ""),
  };
  if (access.status !== "AVAILABLE") return { message: access.message, values };

  const parsed = generateInputSchema.safeParse(values);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors, values };
  const input = toStoredInput(parsed.data);

  if (checkBlocklist(input.note).blocked) {
    await prisma.aiGeneration.create({
      data: {
        eventId: event.id,
        userId: user.id,
        kind: "CERTIFICATE",
        status: "REJECTED",
        failureCode: "BLOCKLIST",
        input,
        promptVersion: IMAGE_PROMPT_VERSION,
        finishedAt: new Date(),
      },
    });
    return { errors: { note: [AI_BLOCKLIST_MESSAGE] }, values };
  }

  const reserved = await reserveGeneration({
    eventId: event.id,
    userId: user.id,
    kind: "CERTIFICATE",
    input,
    promptVersion: IMAGE_PROMPT_VERSION,
  });
  if (!reserved.ok) return { message: reserved.message, values };

  const generationId = reserved.generationId;
  after(() => runGeneration(generationId).catch(() => undefined));
  return { generationId, values };
}
