import { describe, expect, it } from "vitest";

import { AI_FAILURE_MESSAGES, AI_POLL_LOST_MESSAGE, AI_POLL_MAX_FAILURES, failureKindFor } from "@/lib/ai-config";
import { generateInputSchema, storedInputSchema, toStoredInput } from "@/lib/ai/generate-input";
import {
  aiLogoPath,
  aiRawLogoPath,
  aiResultPath,
  aiThumbPath,
  isAiLogoPathFor,
  isAiRawLogoPathFor,
} from "@/lib/ai/paths";
import { aiStatusPayload } from "@/lib/ai/status";

describe("generateInputSchema", () => {
  it("accepts a style with optional color and note", () => {
    expect(generateInputSchema.safeParse({ style: "minimal", colorHex: "", note: "" }).success).toBe(true);
    expect(generateInputSchema.safeParse({ style: "cheerful", colorHex: "#16A34A", note: "seminar kesehatan" }).success).toBe(true);
  });

  it.each([
    ["unknown style", { style: "gothic", colorHex: "", note: "" }],
    ["bad color", { style: "minimal", colorHex: "hijau", note: "" }],
    ["short hex", { style: "minimal", colorHex: "#123", note: "" }],
    ["note over 150 characters", { style: "minimal", colorHex: "", note: "x".repeat(151) }],
  ])("rejects %s", (_name, value) => {
    expect(generateInputSchema.safeParse(value).success).toBe(false);
  });

  it("trims the note before measuring it", () => {
    const parsed = generateInputSchema.parse({ style: "minimal", colorHex: "", note: `  ${"x".repeat(150)}  ` });
    expect(parsed.note).toHaveLength(150);
  });

  it("stores an empty color as null and lowercases a color", () => {
    expect(toStoredInput({ style: "minimal", colorHex: "", note: "" })).toEqual({ style: "minimal", colorHex: null, note: "" });
    const stored = toStoredInput({ style: "minimal", colorHex: "#16A34A", note: "a" });
    expect(stored.colorHex).toBe("#16a34a");
    expect(storedInputSchema.safeParse(stored).success).toBe(true);
  });
});

describe("AI storage paths", () => {
  it("builds the flat per-event paths", () => {
    expect(aiResultPath("e1", "g1")).toBe("events/e1/cert-g1.jpg");
    expect(aiThumbPath("e1", "g1")).toBe("events/e1/cert-g1-thumb.jpg");
    expect(aiLogoPath("e1", "0123456789abcdef")).toBe("events/e1/logo-0123456789abcdef.png");
    expect(aiRawLogoPath("e1", "0123456789abcdef", "jpg")).toBe("events/e1/upload-0123456789abcdef.jpg");
  });

  it("accepts only logo paths that belong to the event", () => {
    expect(isAiLogoPathFor("e1", "events/e1/logo-0123456789abcdef.png")).toBe(true);
    expect(isAiLogoPathFor("e2", "events/e1/logo-0123456789abcdef.png")).toBe(false);
    expect(isAiLogoPathFor("e1", "events/e1/logo-0123456789abcdef.jpg")).toBe(false);
    expect(isAiLogoPathFor("e1", "events/e1/../e2/logo-0123456789abcdef.png")).toBe(false);
    expect(isAiLogoPathFor("e1", "events/e1/cert-g1.jpg")).toBe(false);
    expect(isAiLogoPathFor("e1", "events/e1/logo-XYZ.png")).toBe(false);
  });

  it("accepts only raw upload paths that belong to the event", () => {
    expect(isAiRawLogoPathFor("e1", "events/e1/upload-0123456789abcdef.png")).toBe(true);
    expect(isAiRawLogoPathFor("e1", "events/e1/upload-0123456789abcdef.jpg")).toBe(true);
    expect(isAiRawLogoPathFor("e1", "events/e2/upload-0123456789abcdef.png")).toBe(false);
    expect(isAiRawLogoPathFor("e1", "events/e1/logo-0123456789abcdef.png")).toBe(false);
  });
});

describe("failure messages and status payload", () => {
  it("maps rejected rows to the note message, capacity to busy, everything else to the generic message", () => {
    expect(failureKindFor("REJECTED", "VENDOR_SAFETY")).toBe("NOTE_REJECTED");
    expect(failureKindFor("FAILED", "VENDOR_CAPACITY")).toBe("BUSY");
    for (const code of ["TIMEOUT", "VENDOR_ERROR", "VENDOR_CONFIG", "INVALID_OUTPUT", "STALE", "INTERNAL_ERROR", null]) {
      expect(failureKindFor("FAILED", code)).toBe("TECHNICAL");
    }
  });

  it("never reveals credentials or provider wording for a configuration failure", () => {
    const payload = aiStatusPayload({ status: "FAILED", phase: "IMAGE", failureCode: "VENDOR_CONFIG" });
    expect(payload).toEqual({ status: "FAILED", message: AI_FAILURE_MESSAGES.TECHNICAL });
    expect(JSON.stringify(payload)).not.toMatch(/kredensial|credential|vertex|google|billing/i);
  });

  it("reports the phase while running and nothing else", () => {
    expect(aiStatusPayload({ status: "RUNNING", phase: "IMAGE", failureCode: null })).toEqual({ status: "RUNNING", phase: "IMAGE" });
    expect(aiStatusPayload({ status: "RUNNING", phase: "weird", failureCode: null })).toEqual({ status: "RUNNING", phase: null });
    expect(aiStatusPayload({ status: "SUCCEEDED", phase: "FINALIZE", failureCode: null })).toEqual({ status: "SUCCEEDED" });
  });

  it("explains a rejected note with the unchanged-quota message", () => {
    const payload = aiStatusPayload({ status: "REJECTED", phase: "IMAGE", failureCode: "VENDOR_SAFETY" });
    expect(payload).toEqual({ status: "REJECTED", message: AI_FAILURE_MESSAGES.NOTE_REJECTED });
    expect(AI_FAILURE_MESSAGES.NOTE_REJECTED).toMatch(/Kuota tidak berkurang/);
  });
});

describe("polling loss", () => {
  it("stops after a few consecutive failures and tells the organizer to reload", () => {
    expect(AI_POLL_MAX_FAILURES).toBe(3);
    expect(AI_POLL_LOST_MESSAGE).toMatch(/Muat ulang halaman/);
  });
});
