import { describe, expect, it, vi } from "vitest";

import { AiProviderError, redact, toProviderError } from "@/server/ai/errors";
import { RETRY_MIN_REMAINING_MS, runWithRetry } from "@/server/ai/retry";

describe("toProviderError", () => {
  it.each([
    [{ status: 429, message: "quota" }, "RETRYABLE"],
    [{ status: 503, message: "unavailable" }, "RETRYABLE"],
    [{ status: 408, message: "timeout" }, "RETRYABLE"],
    [{ status: 401, message: "unauthenticated" }, "CONFIG"],
    [{ status: 403, message: "billing disabled" }, "CONFIG"],
    [{ status: 400, message: "invalid argument" }, "CONFIG"],
    [{ status: 400, message: "Request blocked by SAFETY filter" }, "CONFIG"],
    [{ status: 400, message: "blocked", blockReason: "SAFETY" }, "SAFETY"],
    [{ status: 400, message: "x", finishReason: "PROHIBITED_CONTENT" }, "SAFETY"],
    [Object.assign(new Error("deadline"), { name: "TimeoutError" }), "RETRYABLE"],
    [Object.assign(new Error("aborted"), { name: "AbortError" }), "RETRYABLE"],
    [new Error("fetch failed"), "RETRYABLE"],
    ["something odd", "RETRYABLE"],
    [{ message: '{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}' }, "RETRYABLE"],
  ])("maps %j to %s", (error, kind) => {
    expect(toProviderError(error).kind).toBe(kind);
  });

  it("keeps an existing AiProviderError and flags capacity", () => {
    const original = new AiProviderError("x", "SAFETY");
    expect(toProviderError(original)).toBe(original);
    expect(toProviderError({ status: 429 }).isCapacity).toBe(true);
    expect(toProviderError({ status: 500 }).isCapacity).toBe(false);
  });

  it("redacts keys, project ids and service accounts from messages", () => {
    const message = redact(
      "bad -----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY----- in projects/my-secret-project by sa@my-proj.iam.gserviceaccount.com token " +
        "A".repeat(60),
    );
    expect(message).not.toContain("BEGIN PRIVATE");
    expect(message).not.toContain("my-secret-project");
    expect(message).not.toContain("gserviceaccount");
    expect(message).not.toContain("AAAAAAAAAA");
  });
});

describe("runWithRetry", () => {
  const retryable = () => new AiProviderError("busy", "RETRYABLE", 503);

  it("returns on the first success", async () => {
    const run = vi.fn().mockResolvedValue("ok");
    await expect(runWithRetry(run, { deadlineAt: Date.now() + 60_000 })).resolves.toEqual({ value: "ok", attempts: 1 });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("retries once when the error is retryable and at least 20 seconds remain", async () => {
    const run = vi.fn().mockRejectedValueOnce(retryable()).mockResolvedValueOnce("ok");
    await expect(runWithRetry(run, { deadlineAt: Date.now() + 60_000 })).resolves.toEqual({ value: "ok", attempts: 2 });
  });

  it("does not retry when less than 20 seconds remain", async () => {
    let clock = 0;
    const run = vi.fn().mockImplementation(async () => {
      clock = 41_000;
      throw retryable();
    });
    await expect(runWithRetry(run, { deadlineAt: 60_000, now: () => clock })).rejects.toMatchObject({
      kind: "RETRYABLE",
      attempts: 1,
    });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("retries when exactly the minimum time remains", async () => {
    let clock = 0;
    const run = vi
      .fn()
      .mockImplementationOnce(async () => {
        clock = 60_000 - RETRY_MIN_REMAINING_MS;
        throw retryable();
      })
      .mockResolvedValueOnce("ok");
    await expect(runWithRetry(run, { deadlineAt: 60_000, now: () => clock })).resolves.toMatchObject({ attempts: 2 });
  });

  it("gives up after a single retry", async () => {
    const run = vi.fn().mockRejectedValue(retryable());
    await expect(runWithRetry(run, { deadlineAt: Date.now() + 60_000 })).rejects.toMatchObject({ attempts: 2 });
    expect(run).toHaveBeenCalledTimes(2);
  });

  it.each(["SAFETY", "CONFIG"] as const)("never retries %s errors", async (kind) => {
    const run = vi.fn().mockRejectedValue(new AiProviderError("no", kind));
    await expect(runWithRetry(run, { deadlineAt: Date.now() + 60_000 })).rejects.toMatchObject({ kind, attempts: 1 });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("fails without calling when the deadline has passed", async () => {
    const run = vi.fn();
    await expect(runWithRetry(run, { deadlineAt: Date.now() - 1 })).rejects.toMatchObject({ kind: "RETRYABLE" });
    expect(run).not.toHaveBeenCalled();
  });

  it("passes a signal bound to the remaining time", async () => {
    const { value } = await runWithRetry(async (signal: AbortSignal) => signal, { deadlineAt: Date.now() + 5_000 });
    expect(value.aborted).toBe(false);
  });
});
