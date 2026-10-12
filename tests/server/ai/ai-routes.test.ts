import { beforeEach, describe, expect, it, vi } from "vitest";

import { AI_FAILURE_MESSAGES, AI_UNAVAILABLE_CODE, AI_UNAVAILABLE_MESSAGE } from "@/lib/ai-config";

const mocks = vi.hoisted(() => ({
  requireEventOwner: vi.fn(),
  getAiAccess: vi.fn(),
  sweep: vi.fn(),
  findFirst: vi.fn(),
  renderAiPreview: vi.fn(),
  getConfig: vi.fn(),
  loadSigners: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/server/authz", () => ({ requireEventOwner: mocks.requireEventOwner }));
vi.mock("@/server/ai-access", () => ({ getAiAccess: mocks.getAiAccess }));
vi.mock("@/server/ai-quota", () => ({ sweepStaleGenerations: mocks.sweep }));
vi.mock("@/server/db", () => ({ prisma: { aiGeneration: { findFirst: mocks.findFirst } } }));
vi.mock("@/server/ai/preview", () => {
  class AiPreviewUnavailableError extends Error {}
  return { AiPreviewUnavailableError, renderAiPreview: mocks.renderAiPreview };
});
vi.mock("@/server/certificate-config", () => ({ getOrCreateCertificateConfig: mocks.getConfig }));
vi.mock("@/server/signers", () => ({ loadSignerRenderData: mocks.loadSigners }));

const { GET: status } = await import("@/app/organizer/events/[id]/certificate/ai/[genId]/status/route");
const { GET: preview } = await import("@/app/organizer/events/[id]/certificate/ai/[genId]/preview/route");
const { AiPreviewUnavailableError } = await import("@/server/ai/preview");

const context = (id = "ev1", genId = "gen1") => ({ params: Promise.resolve({ id, genId }) }) as never;
const owner = { user: { id: "user1" }, event: { id: "ev1", title: "Seminar", startAt: new Date(), timezone: "Asia/Jakarta" }, organizer: { orgName: "HIMA" } };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireEventOwner.mockResolvedValue(owner);
  mocks.getAiAccess.mockResolvedValue({ status: "AVAILABLE", remaining: 3 });
  mocks.getConfig.mockResolvedValue({ layout: {} });
  mocks.loadSigners.mockResolvedValue([]);
  mocks.renderAiPreview.mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
});

describe("GET status", () => {
  it("is refused for someone who does not own the event, before any query", async () => {
    mocks.requireEventOwner.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(status(new Request("http://x"), context())).rejects.toThrow("NOT_FOUND");
    expect(mocks.getAiAccess).not.toHaveBeenCalled();
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("answers 404 with the generic unavailable code when AI is hidden", async () => {
    mocks.getAiAccess.mockResolvedValue({ status: "HIDDEN", message: AI_UNAVAILABLE_MESSAGE });
    const response = await status(new Request("http://x"), context());
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ code: AI_UNAVAILABLE_CODE, message: AI_UNAVAILABLE_MESSAGE });
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("looks the generation up by id and the guarded event only, and 404s for another event", async () => {
    mocks.findFirst.mockResolvedValue(null);
    await expect(status(new Request("http://x"), context("ev1", "gen-of-other-event"))).rejects.toThrow("NOT_FOUND");
    expect(mocks.findFirst.mock.calls[0][0].where).toEqual({ id: "gen-of-other-event", eventId: "ev1", kind: "CERTIFICATE" });
  });

  it("sweeps stale rows lazily and returns the running phase with no-store", async () => {
    mocks.findFirst.mockResolvedValue({ status: "RUNNING", phase: "IMAGE", failureCode: null });
    const response = await status(new Request("http://x"), context());
    expect(mocks.sweep).toHaveBeenCalledTimes(1);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ status: "RUNNING", phase: "IMAGE" });
  });

  it("returns only the generic message for a failed generation", async () => {
    mocks.findFirst.mockResolvedValue({ status: "FAILED", phase: "IMAGE", failureCode: "VENDOR_CONFIG" });
    expect(await (await status(new Request("http://x"), context())).json()).toEqual({
      status: "FAILED",
      message: AI_FAILURE_MESSAGES.TECHNICAL,
    });
  });

  it("returns the busy message when the vendor was at capacity", async () => {
    mocks.findFirst.mockResolvedValue({ status: "FAILED", phase: "IMAGE", failureCode: "VENDOR_CAPACITY" });
    expect(await (await status(new Request("http://x"), context())).json()).toEqual({
      status: "FAILED",
      message: AI_FAILURE_MESSAGES.BUSY,
    });
  });

  it("returns SUCCEEDED without exposing file paths", async () => {
    mocks.findFirst.mockResolvedValue({ status: "SUCCEEDED", phase: "FINALIZE", failureCode: null });
    expect(await (await status(new Request("http://x"), context())).json()).toEqual({ status: "SUCCEEDED" });
  });
});

describe("GET preview", () => {
  const url = (logo?: string) => `http://x/preview${logo === undefined ? "" : `?logo=${encodeURIComponent(logo)}`}`;
  const generation = { brief: {}, resultPaths: ["events/ev1/cert-gen1.jpg"] };

  it("is refused for someone who does not own the event, before rendering", async () => {
    mocks.requireEventOwner.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(preview(new Request(url()), context())).rejects.toThrow("NOT_FOUND");
    expect(mocks.renderAiPreview).not.toHaveBeenCalled();
  });

  it("answers 404 with the generic unavailable code when AI is hidden", async () => {
    mocks.getAiAccess.mockResolvedValue({ status: "HIDDEN", message: AI_UNAVAILABLE_MESSAGE });
    const response = await preview(new Request(url()), context());
    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe(AI_UNAVAILABLE_CODE);
    expect(mocks.renderAiPreview).not.toHaveBeenCalled();
  });

  it.each([
    "events/ev2/logo-0123456789abcdef.png",
    "events/ev1/cert-gen1.jpg",
    "events/ev1/../ev2/logo-0123456789abcdef.png",
    "https://evil.test/logo.png",
  ])("rejects the logo %s without querying the generation", async (logo) => {
    await expect(preview(new Request(url(logo)), context())).rejects.toThrow("NOT_FOUND");
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.renderAiPreview).not.toHaveBeenCalled();
  });

  it("only previews a successful, unreported, unpurged generation of the guarded event", async () => {
    mocks.findFirst.mockResolvedValue(null);
    await expect(preview(new Request(url()), context("ev1", "gen-of-other"))).rejects.toThrow("NOT_FOUND");
    expect(mocks.findFirst.mock.calls[0][0].where).toEqual({
      id: "gen-of-other",
      eventId: "ev1",
      kind: "CERTIFICATE",
      status: "SUCCEEDED",
      reportedAt: null,
      purgedAt: null,
    });
    expect(mocks.renderAiPreview).not.toHaveBeenCalled();
  });

  it("renders a no-store PDF without a logo for none or a missing parameter", async () => {
    mocks.findFirst.mockResolvedValue(generation);
    for (const request of [url(), url("none")]) {
      const response = await preview(new Request(request), context());
      expect(response.headers.get("Content-Type")).toBe("application/pdf");
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    }
    expect(mocks.renderAiPreview.mock.calls.every((call) => call[0].logoPath === null)).toBe(true);
  });

  it("passes a logo of the event, the guarded event id and the organizer name to the renderer", async () => {
    mocks.findFirst.mockResolvedValue(generation);
    await preview(new Request(url("events/ev1/logo-0123456789abcdef.png")), context());
    expect(mocks.renderAiPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: "ev1",
        organizerName: "HIMA",
        logoPath: "events/ev1/logo-0123456789abcdef.png",
        generation,
      }),
    );
  });

  it("answers 404 when the stored files are gone", async () => {
    mocks.findFirst.mockResolvedValue(generation);
    mocks.renderAiPreview.mockRejectedValue(new AiPreviewUnavailableError());
    await expect(preview(new Request(url()), context())).rejects.toThrow("NOT_FOUND");
  });

  it("lets unexpected render errors surface", async () => {
    mocks.findFirst.mockResolvedValue(generation);
    mocks.renderAiPreview.mockRejectedValue(new Error("boom"));
    await expect(preview(new Request(url()), context())).rejects.toThrow("boom");
  });
});
