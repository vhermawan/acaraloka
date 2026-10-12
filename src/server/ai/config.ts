import "server-only";

import { env } from "@/lib/env";
import { createVertexImageProvider } from "@/server/ai/providers/vertex-image";
import { createVertexTextProvider } from "@/server/ai/providers/vertex-text";
import type { ImageProvider, TextProvider } from "@/server/ai/types";
import { getVertexClient } from "@/server/ai/vertex-client";

const IMAGE_PROVIDERS: Record<typeof env.AI_IMAGE_PROVIDER, () => ImageProvider> = {
  vertex: () => createVertexImageProvider(getVertexClient(), env.VERTEX_IMAGE_MODEL),
};

const TEXT_PROVIDERS: Record<typeof env.AI_TEXT_PROVIDER, () => TextProvider> = {
  vertex: () => createVertexTextProvider(getVertexClient(), env.VERTEX_TEXT_MODEL),
};

export function getImageProvider(): ImageProvider {
  return IMAGE_PROVIDERS[env.AI_IMAGE_PROVIDER]();
}

export function getTextProvider(): TextProvider {
  return TEXT_PROVIDERS[env.AI_TEXT_PROVIDER]();
}
