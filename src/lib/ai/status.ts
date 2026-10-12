import { AI_FAILURE_MESSAGES, failureKindFor, type AiPhase } from "@/lib/ai-config";

export type AiStatusPayload =
  | { status: "RUNNING"; phase: AiPhase | null }
  | { status: "SUCCEEDED" }
  | { status: "FAILED" | "REJECTED"; message: string };

export function aiStatusPayload(row: { status: string; phase: string | null; failureCode: string | null }): AiStatusPayload {
  if (row.status === "RUNNING") {
    const phase = row.phase === "BRIEF" || row.phase === "IMAGE" || row.phase === "FINALIZE" ? row.phase : null;
    return { status: "RUNNING", phase };
  }
  if (row.status === "SUCCEEDED") return { status: "SUCCEEDED" };
  const status = row.status === "REJECTED" ? "REJECTED" : "FAILED";
  return { status, message: AI_FAILURE_MESSAGES[failureKindFor(status, row.failureCode)] };
}
