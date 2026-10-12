import "server-only";

import type { GenerateContentResponse } from "@google/genai";

import { imageCostMicros } from "@/lib/ai-config";
import { AiProviderError, toProviderError } from "@/server/ai/errors";
import { ImageOpsError, readImageDimensions } from "@/server/ai/image-ops";
import { imagePrompt } from "@/server/ai/prompts/image";
import type { CallContext, ImageProvider, ImageRequest, ImageResult } from "@/server/ai/types";
import type { VertexClient } from "@/server/ai/vertex-client";

export const VERTEX_IMAGE_MAX_WIDTH = 2560;

const ASPECT_RATIOS: Record<ImageRequest["aspect"], string> = { A4_LANDSCAPE: "3:2", "4:5": "4:5" };
const SAFETY_FINISH = /SAFETY|PROHIBITED|IMAGE_OTHER|BLOCK/i;

function usageOf(response: GenerateContentResponse) {
  const usage = response.usageMetadata;
  const imageOutputTokens =
    usage?.candidatesTokensDetails?.find((detail) => detail.modality === "IMAGE")?.tokenCount ?? 0;
  return {
    promptTokens: usage?.promptTokenCount ?? 0,
    outputTokens: usage?.candidatesTokenCount ?? 0,
    thoughtTokens: usage?.thoughtsTokenCount ?? 0,
    imageOutputTokens,
  };
}

export function createVertexImageProvider(client: VertexClient, model: string): ImageProvider {
  return {
    id: "vertex",
    model,
    supports: (request) =>
      request.kind === "CERTIFICATE" && request.aspect === "A4_LANDSCAPE" && request.minWidth <= VERTEX_IMAGE_MAX_WIDTH,
    async generate(request: ImageRequest, { signal }: CallContext): Promise<ImageResult> {
      try {
        const response = await client.models.generateContent({
          model,
          contents: imagePrompt(request.spec),
          config: {
            responseModalities: ["IMAGE"],
            imageConfig: { aspectRatio: ASPECT_RATIOS[request.aspect], imageSize: "2K" },
            abortSignal: signal,
          },
        });

        const blockReason = response.promptFeedback?.blockReason;
        if (blockReason) throw new AiProviderError(`Prompt blocked: ${String(blockReason)}`, "SAFETY");

        const candidate = response.candidates?.[0];
        const part = candidate?.content?.parts?.find((item) => item.inlineData?.data);
        if (!part?.inlineData?.data) {
          const reason = String(candidate?.finishReason ?? "NO_IMAGE");
          throw new AiProviderError(
            `No image in response (finishReason ${reason})`,
            SAFETY_FINISH.test(reason) ? "SAFETY" : "RETRYABLE",
          );
        }

        const bytes = new Uint8Array(Buffer.from(part.inlineData.data, "base64"));
        const dimensions = await readImageDimensions(bytes).catch((error: unknown) => {
          if (error instanceof ImageOpsError) throw new AiProviderError("Image output cannot be decoded", "RETRYABLE");
          throw error;
        });

        return {
          bytes,
          mime: part.inlineData.mimeType ?? "image/png",
          width: dimensions.width,
          height: dimensions.height,
          costMicros: imageCostMicros(usageOf(response)),
        };
      } catch (error) {
        throw toProviderError(error);
      }
    },
  };
}
