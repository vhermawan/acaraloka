import "server-only";

import { textCostMicros } from "@/lib/ai-config";
import { AiProviderError, toProviderError } from "@/server/ai/errors";
import type { CallContext, JsonRequest, TextProvider } from "@/server/ai/types";
import type { VertexClient } from "@/server/ai/vertex-client";

export function createVertexTextProvider(client: VertexClient, model: string): TextProvider {
  return {
    id: "vertex",
    model,
    async generateJson(input: JsonRequest, { signal }: CallContext) {
      try {
        const response = await client.models.generateContent({
          model,
          contents: input.user,
          config: {
            systemInstruction: input.system,
            responseMimeType: "application/json",
            responseJsonSchema: input.jsonSchema,
            temperature: 0.7,
            abortSignal: signal,
          },
        });

        const blockReason = response.promptFeedback?.blockReason;
        if (blockReason) throw new AiProviderError(`Prompt blocked: ${String(blockReason)}`, "SAFETY");

        const text = response.text;
        if (!text) throw new AiProviderError("Empty text response", "RETRYABLE");

        let json: unknown;
        try {
          json = JSON.parse(text);
        } catch {
          throw new AiProviderError("Text response is not valid JSON", "RETRYABLE");
        }

        const usage = response.usageMetadata;
        return {
          json,
          costMicros: textCostMicros({
            promptTokens: usage?.promptTokenCount ?? 0,
            outputTokens: usage?.candidatesTokenCount ?? 0,
            thoughtTokens: usage?.thoughtsTokenCount ?? 0,
            imageOutputTokens: 0,
          }),
        };
      } catch (error) {
        throw toProviderError(error);
      }
    },
  };
}
