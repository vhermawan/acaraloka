import "server-only";

import type { AiDesignBrief } from "@/lib/ai/design-brief";
import type { StyleKey } from "@/lib/ai/styles";

export type AiKind = "CERTIFICATE" | "POSTER";

export type PromptSpec = {
  style: StyleKey;
  brief: AiDesignBrief;
};

export type ImageRequest = {
  kind: AiKind;
  aspect: "A4_LANDSCAPE" | "4:5";
  minWidth: number;
  spec: PromptSpec;
};

export type ImageResult = {
  bytes: Uint8Array;
  mime: string;
  width: number;
  height: number;
  costMicros: number;
};

export type CallContext = { signal: AbortSignal };

export interface ImageProvider {
  id: string;
  model: string;
  supports(request: ImageRequest): boolean;
  generate(request: ImageRequest, context: CallContext): Promise<ImageResult>;
}

export type JsonRequest = { system: string; user: string; jsonSchema: object };

export interface TextProvider {
  id: string;
  model: string;
  generateJson(input: JsonRequest, context: CallContext): Promise<{ json: unknown; costMicros: number }>;
}
