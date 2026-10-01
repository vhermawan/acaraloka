import { createHash } from "node:crypto";

export function normalizeErrorMessage(message: string): string {
  return message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<uuid>")
    .replace(/\bc(?=[a-z0-9]*\d)[a-z0-9]{20,31}\b/g, "<id>")
    .replace(/\b[0-9a-f]{16,}\b/gi, "<hex>")
    .replace(/\d+/g, "<n>")
    .trim();
}

function firstStackFrame(stack: string | undefined): string {
  if (!stack) return "";
  const frame = stack.split("\n").find((line) => line.trim().startsWith("at "));
  return frame ? frame.trim().replace(/:\d+:\d+\)?$/, "") : "";
}

export function buildErrorFingerprint(input: {
  source: string;
  name: string;
  message: string;
  stack?: string;
}): string {
  const key = [input.source, input.name, normalizeErrorMessage(input.message), firstStackFrame(input.stack)].join("|");
  return createHash("sha256").update(key).digest("hex");
}
