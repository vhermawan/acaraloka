import "server-only";

import { checkBlocklist, hasForbiddenVisual } from "@/lib/ai/blocklist";
import { aiDesignBriefSchema, type AiDesignBrief, type BriefInput } from "@/lib/ai/design-brief";
import { presetBriefFor } from "@/lib/ai/style-presets";
import { toProviderError, type AiProviderErrorKind } from "@/server/ai/errors";
import { BRIEF_SYSTEM_PROMPT, briefJsonSchema, briefUserPrompt } from "@/server/ai/prompts/brief";
import type { TextProvider } from "@/server/ai/types";

export const BRIEF_TIMEOUT_MS = 12_000;

export type BriefFallbackReason = "INVALID" | "UNSAFE_TEXT" | `PROVIDER_${AiProviderErrorKind}`;

export type BriefOutcome =
  | { source: "LLM"; brief: AiDesignBrief; costMicros: number; fallbackReason: null }
  | { source: "PRESET"; brief: AiDesignBrief; costMicros: number; fallbackReason: BriefFallbackReason };

function textsOf(brief: AiDesignBrief): string[] {
  return [brief.visualDescription, ...brief.motifs];
}

function isAllowed(brief: AiDesignBrief): boolean {
  return textsOf(brief).every((text) => !checkBlocklist(text).blocked && !hasForbiddenVisual(text));
}

export async function buildBrief(
  input: BriefInput,
  provider: TextProvider,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<BriefOutcome> {
  const preset = (reason: BriefFallbackReason, costMicros = 0): BriefOutcome => ({
    source: "PRESET",
    brief: presetBriefFor(input.style, input.primaryColor),
    costMicros,
    fallbackReason: reason,
  });

  const timeout = AbortSignal.timeout(options.timeoutMs ?? BRIEF_TIMEOUT_MS);
  const signal = options.signal ? AbortSignal.any([timeout, options.signal]) : timeout;

  let result;
  try {
    result = await provider.generateJson(
      { system: BRIEF_SYSTEM_PROMPT, user: briefUserPrompt(input), jsonSchema: briefJsonSchema },
      { signal },
    );
  } catch (error) {
    return preset(`PROVIDER_${toProviderError(error).kind}`);
  }

  const parsed = aiDesignBriefSchema.safeParse(result.json);
  if (!parsed.success) return preset("INVALID", result.costMicros);
  if (!isAllowed(parsed.data)) return preset("UNSAFE_TEXT", result.costMicros);

  const brief = input.primaryColor
    ? { ...parsed.data, palette: { ...parsed.data.palette, primary: input.primaryColor } }
    : parsed.data;
  return { source: "LLM", brief, costMicros: result.costMicros, fallbackReason: null };
}
