import "server-only";

import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import { env } from "@/lib/env";
import { AiProviderError } from "@/server/ai/errors";

const serviceAccountSchema = z.object({
  client_email: z.string().min(1),
  private_key: z.string().min(1),
  project_id: z.string().min(1),
});

export type ServiceAccount = z.infer<typeof serviceAccountSchema>;

export type VertexClient = { models: Pick<GoogleGenAI["models"], "generateContent"> };

export function parseServiceAccount(base64: string | undefined): ServiceAccount {
  if (!base64) throw new AiProviderError("GOOGLE_VERTEX_SA_KEY_B64 is empty", "CONFIG");
  let raw: unknown;
  try {
    raw = JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
  } catch {
    throw new AiProviderError("GOOGLE_VERTEX_SA_KEY_B64 is not valid base64 JSON", "CONFIG");
  }
  const parsed = serviceAccountSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AiProviderError("Service account JSON misses client_email, private_key or project_id", "CONFIG");
  }
  return parsed.data;
}

export function createVertexClient(input: { account: ServiceAccount; project: string; location: string }): VertexClient {
  return new GoogleGenAI({
    vertexai: true,
    project: input.project,
    location: input.location,
    googleAuthOptions: {
      credentials: { client_email: input.account.client_email, private_key: input.account.private_key },
    },
  });
}

let cached: VertexClient | null = null;

export function getVertexClient(): VertexClient {
  if (cached) return cached;
  const account = parseServiceAccount(env.GOOGLE_VERTEX_SA_KEY_B64);
  cached = createVertexClient({
    account,
    project: env.GOOGLE_VERTEX_PROJECT ?? account.project_id,
    location: env.GOOGLE_VERTEX_LOCATION,
  });
  return cached;
}
