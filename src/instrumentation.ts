import type { Instrumentation } from "next";

const CONTROL_FLOW_DIGESTS = ["NEXT_REDIRECT", "NEXT_HTTP_ERROR_FALLBACK", "NEXT_NOT_FOUND"];

function isControlFlowError(error: unknown) {
  if (typeof error !== "object" || error === null || !("digest" in error)) return false;
  const digest = String(error.digest);
  return CONTROL_FLOW_DIGESTS.some((prefix) => digest.startsWith(prefix));
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs" || isControlFlowError(error)) return;

  try {
    const { recordError } = await import("@/server/error-log");
    await recordError({
      source: `${context.routeType}:${context.routePath}`,
      error,
      context: {
        path: request.path,
        method: request.method,
        routeType: context.routeType,
        renderSource: context.renderSource ?? null,
      },
    });
  } catch (loggingError) {
    console.error("Failed to record error", loggingError);
  }
};
