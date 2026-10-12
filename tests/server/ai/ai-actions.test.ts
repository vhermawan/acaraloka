import { beforeEach, describe, expect, it, vi } from "vitest";

import { AI_UNAVAILABLE_CODE, AI_UNAVAILABLE_MESSAGE } from "@/lib/ai-config";
import { AI_BLOCKLIST_MESSAGE, LOGO_INVALID_MESSAGE } from "@/lib/ai/generate-input";
import { isAiRawLogoPathFor } from "@/lib/ai/paths";

const mocks = vi.hoisted(() => ({
  requireEventOwner: vi.fn(),
  getAiAccess: vi.fn(),
  reserveGeneration: vi.fn(),
  runGeneration: vi.fn(),
  after: vi.fn(),
  create: vi.fn(),
  createSignedUploadUrl: vi.fn(),
  finalizeLogoUpload: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/server/authz", () => ({ requireEventOwner: mocks.requireEventOwner }));
vi.mock("@/server/ai-access", () => ({ getAiAccess: mocks.getAiAccess }));
vi.mock("@/server/ai-quota", () => ({ reserveGeneration: mocks.reserveGeneration }));
vi.mock("@/server/ai/generation-job", () => ({ runGeneration: mocks.runGeneration }));
vi.mock("@/server/ai/logo", () => ({ finalizeLogoUpload: mocks.finalizeLogoUpload }));
vi.mock("@/server/db", () => ({ prisma: { aiGeneration: { create: mocks.create } } }));
vi.mock("@/server/storage", () => ({ AI_BUCKET: "ai-generations", createSignedUploadUrl: mocks.createSignedUploadUrl }));

const { createAiLogoUpload, finalizeAiLogo, startAiGeneration } = await import(
  "@/app/organizer/events/[id]/certificate/ai/actions"
);

const owner = { user: { id: "user1" }, event: { id: "ev1" }, organizer: {} };

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const valid = { style: "formal-campus", colorHex: "", note: "" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireEventOwner.mockResolvedValue(owner);
  mocks.getAiAccess.mockResolvedValue({ status: "AVAILABLE", remaining: 3 });
  mocks.reserveGeneration.mockResolvedValue({ ok: true, generationId: "gen1", estCostMicros: 1, reused: false });
});

describe("startAiGeneration", () => {
  it("checks ownership first, then access, and returns the generic message when AI is hidden", async () => {
    mocks.getAiAccess.mockResolvedValue({ status: "HIDDEN", message: AI_UNAVAILABLE_MESSAGE });
    const result = await startAiGeneration("ev1", {}, form(valid));
    expect(result).toEqual({ code: AI_UNAVAILABLE_CODE, message: AI_UNAVAILABLE_MESSAGE });
    expect(mocks.requireEventOwner).toHaveBeenCalledWith("ev1");
    expect(mocks.getAiAccess).toHaveBeenCalledWith(owner.user, { eventId: "ev1", kind: "CERTIFICATE" });
    expect(mocks.reserveGeneration).not.toHaveBeenCalled();
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("does not run when ownership fails", async () => {
    mocks.requireEventOwner.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(startAiGeneration("ev1", {}, form(valid))).rejects.toThrow("NOT_FOUND");
    expect(mocks.getAiAccess).not.toHaveBeenCalled();
    expect(mocks.reserveGeneration).not.toHaveBeenCalled();
  });

  it.each(["PAUSED", "LOCKED", "QUOTA", "DAILY"])("returns the %s message without reserving", async (status) => {
    mocks.getAiAccess.mockResolvedValue({ status, message: `pesan ${status}` });
    const result = await startAiGeneration("ev1", {}, form(valid));
    expect(result.message).toBe(`pesan ${status}`);
    expect(mocks.reserveGeneration).not.toHaveBeenCalled();
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it.each([
    ["an unknown style", { ...valid, style: "gothic" }, "style"],
    ["a malformed color", { ...valid, colorHex: "hijau" }, "colorHex"],
    ["a note over 150 characters", { ...valid, note: "x".repeat(151) }, "note"],
  ])("rejects %s before reserving", async (_name, fields, field) => {
    const result = await startAiGeneration("ev1", {}, form(fields));
    expect(result.errors?.[field as "style"]?.length).toBeGreaterThan(0);
    expect(result.values).toMatchObject(fields);
    expect(mocks.reserveGeneration).not.toHaveBeenCalled();
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("rejects a blocked note, records a BLOCKLIST row and never reserves or calls a vendor", async () => {
    const result = await startAiGeneration("ev1", {}, form({ ...valid, note: "acara bokep kampus" }));
    expect(result.errors?.note).toEqual([AI_BLOCKLIST_MESSAGE]);
    expect(AI_BLOCKLIST_MESSAGE).toMatch(/Kuota tidak berkurang/);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create.mock.calls[0][0].data).toMatchObject({
      eventId: "ev1",
      userId: "user1",
      kind: "CERTIFICATE",
      status: "REJECTED",
      failureCode: "BLOCKLIST",
    });
    expect(mocks.reserveGeneration).not.toHaveBeenCalled();
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("passes a denied reservation message through and schedules nothing", async () => {
    mocks.reserveGeneration.mockResolvedValue({ ok: false, reason: "EVENT_RUNNING", message: "Desain sebelumnya masih dibuat. Tunggu hingga selesai." });
    const result = await startAiGeneration("ev1", {}, form(valid));
    expect(result.message).toBe("Desain sebelumnya masih dibuat. Tunggu hingga selesai.");
    expect(result.generationId).toBeUndefined();
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("reserves with ids from the guard, stores the normalized input, and runs the job in after()", async () => {
    const result = await startAiGeneration(
      "ev1",
      {},
      form({ style: "cheerful", colorHex: "#16A34A", note: "  seminar kesehatan ", eventId: "other-event", userId: "other-user" }),
    );
    expect(result).toMatchObject({ generationId: "gen1" });
    expect(mocks.reserveGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: "ev1",
        userId: "user1",
        kind: "CERTIFICATE",
        input: { style: "cheerful", colorHex: "#16a34a", note: "seminar kesehatan" },
      }),
    );
    expect(mocks.after).toHaveBeenCalledTimes(1);
    expect(mocks.runGeneration).not.toHaveBeenCalled();
    await mocks.after.mock.calls[0][0]();
    expect(mocks.runGeneration).toHaveBeenCalledWith("gen1");
  });

  it("allows an empty note and color", async () => {
    const result = await startAiGeneration("ev1", {}, form(valid));
    expect(result.generationId).toBe("gen1");
    expect(mocks.reserveGeneration.mock.calls[0][0].input).toEqual({ style: "formal-campus", colorHex: null, note: "" });
  });
});

describe("createAiLogoUpload", () => {
  it("returns the generic message when AI is hidden", async () => {
    mocks.getAiAccess.mockResolvedValue({ status: "HIDDEN", message: AI_UNAVAILABLE_MESSAGE });
    expect(await createAiLogoUpload("ev1", { contentType: "image/png", size: 100 })).toEqual({ error: AI_UNAVAILABLE_MESSAGE });
    expect(mocks.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it.each([
    ["a GIF", { contentType: "image/gif", size: 100 }],
    ["a WebP", { contentType: "image/webp", size: 100 }],
    ["an empty file", { contentType: "image/png", size: 0 }],
    ["a file over 2 MB", { contentType: "image/png", size: 2 * 1024 * 1024 + 1 }],
  ])("rejects %s", async (_name, file) => {
    expect(await createAiLogoUpload("ev1", file)).toEqual({ error: LOGO_INVALID_MESSAGE });
    expect(mocks.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("signs an upload to a raw path under the guarded event", async () => {
    mocks.createSignedUploadUrl.mockResolvedValue("https://storage.test/upload");
    const result = await createAiLogoUpload("ev1", { contentType: "image/jpeg", size: 1000 });
    expect(result).toMatchObject({ uploadUrl: "https://storage.test/upload" });
    const path = (result as { path: string }).path;
    expect(isAiRawLogoPathFor("ev1", path)).toBe(true);
    expect(path.endsWith(".jpg")).toBe(true);
    expect(mocks.createSignedUploadUrl).toHaveBeenCalledWith("ai-generations", path);
  });
});

describe("finalizeAiLogo", () => {
  it("returns the generic message when AI is hidden", async () => {
    mocks.getAiAccess.mockResolvedValue({ status: "HIDDEN", message: AI_UNAVAILABLE_MESSAGE });
    expect(await finalizeAiLogo("ev1", "events/ev1/upload-0123456789abcdef.png")).toEqual({ error: AI_UNAVAILABLE_MESSAGE });
    expect(mocks.finalizeLogoUpload).not.toHaveBeenCalled();
  });

  it("finalizes with the event id from the guard and revalidates on success", async () => {
    mocks.finalizeLogoUpload.mockResolvedValue({ ok: true, path: "events/ev1/logo-0123456789abcdef.png" });
    const result = await finalizeAiLogo("ev1", "events/ev1/upload-0123456789abcdef.png");
    expect(result).toEqual({ path: "events/ev1/logo-0123456789abcdef.png" });
    expect(mocks.finalizeLogoUpload).toHaveBeenCalledWith("ev1", "events/ev1/upload-0123456789abcdef.png");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/organizer/events/ev1/certificate/ai");
  });

  it("returns the validation message without revalidating", async () => {
    mocks.finalizeLogoUpload.mockResolvedValue({ ok: false, error: LOGO_INVALID_MESSAGE });
    expect(await finalizeAiLogo("ev1", "events/ev2/upload-0123456789abcdef.png")).toEqual({ error: LOGO_INVALID_MESSAGE });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
