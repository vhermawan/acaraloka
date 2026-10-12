import { beforeEach, describe, expect, it, vi } from "vitest";

import { AI_ORPHAN_UPLOAD_MS } from "@/lib/ai-config";

const mocks = vi.hoisted(() => ({
  listObjectEntries: vi.fn(),
  removeObjects: vi.fn(),
  removeObjectsQuietly: vi.fn(),
  reportCleanupFailure: vi.fn(),
}));

vi.mock("@/server/storage", () => ({
  AI_BUCKET: "ai-generations",
  listObjectEntries: mocks.listObjectEntries,
  removeObjects: mocks.removeObjects,
}));
vi.mock("@/server/storage-cleanup", () => ({
  removeObjectsQuietly: mocks.removeObjectsQuietly,
  reportCleanupFailure: mocks.reportCleanupFailure,
}));

const { countEventLogos, deleteEventLogo, removeAiEventArtifacts, sweepOrphanUploads } = await import("@/server/ai/artifacts");

const now = new Date("2026-10-12T10:00:00Z");
const old = new Date(now.getTime() - AI_ORPHAN_UPLOAD_MS - 1000);
const fresh = new Date(now.getTime() - 60_000);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.removeObjects.mockResolvedValue(undefined);
});

describe("countEventLogos", () => {
  it("counts only finalized logos of the event", async () => {
    mocks.listObjectEntries.mockResolvedValue([
      { path: "events/ev1/logo-aaaaaaaaaaaaaaaa.png", createdAt: null },
      { path: "events/ev1/logo-bbbbbbbbbbbbbbbb.png", createdAt: null },
      { path: "events/ev1/upload-cccccccccccccccc.png", createdAt: null },
      { path: "events/ev1/cert-g1.jpg", createdAt: null },
    ]);
    expect(await countEventLogos("ev1")).toBe(2);
    expect(mocks.listObjectEntries).toHaveBeenCalledWith("ai-generations", "events/ev1");
  });

  it("also counts pending raw uploads when asked", async () => {
    mocks.listObjectEntries.mockResolvedValue([
      { path: "events/ev1/logo-aaaaaaaaaaaaaaaa.png", createdAt: null },
      { path: "events/ev1/upload-cccccccccccccccc.png", createdAt: null },
      { path: "events/ev2/upload-dddddddddddddddd.png", createdAt: null },
    ]);
    expect(await countEventLogos("ev1", { includePending: true })).toBe(2);
  });
});

describe("sweepOrphanUploads", () => {
  it("removes only old raw uploads and keeps fresh, undated and finalized files", async () => {
    mocks.listObjectEntries.mockResolvedValue([
      { path: "events/ev1/upload-aaaaaaaaaaaaaaaa.png", createdAt: old },
      { path: "events/ev1/upload-bbbbbbbbbbbbbbbb.jpg", createdAt: fresh },
      { path: "events/ev1/upload-cccccccccccccccc.png", createdAt: null },
      { path: "events/ev1/logo-dddddddddddddddd.png", createdAt: old },
      { path: "events/ev1/cert-g1.jpg", createdAt: old },
    ]);
    await sweepOrphanUploads("ev1", now);
    expect(mocks.removeObjects).toHaveBeenCalledWith("ai-generations", ["events/ev1/upload-aaaaaaaaaaaaaaaa.png"]);
  });

  it("reports instead of throwing when storage fails", async () => {
    mocks.listObjectEntries.mockRejectedValue(new Error("down"));
    await expect(sweepOrphanUploads("ev1", now)).resolves.toBeUndefined();
    expect(mocks.reportCleanupFailure).toHaveBeenCalledWith("ai.logo.sweep", expect.any(Error), { eventId: "ev1" });
  });
});

describe("deleteEventLogo", () => {
  it("deletes a logo of the event", async () => {
    expect(await deleteEventLogo("ev1", "events/ev1/logo-aaaaaaaaaaaaaaaa.png")).toBe(true);
    expect(mocks.removeObjectsQuietly).toHaveBeenCalledWith(expect.any(String), "ai-generations", [
      "events/ev1/logo-aaaaaaaaaaaaaaaa.png",
    ]);
  });

  it.each([
    ["another event", "events/ev2/logo-aaaaaaaaaaaaaaaa.png"],
    ["a generated result", "events/ev1/cert-g1.jpg"],
    ["a traversal path", "events/ev1/../ev2/logo-aaaaaaaaaaaaaaaa.png"],
  ])("refuses %s", async (_name, path) => {
    expect(await deleteEventLogo("ev1", path)).toBe(false);
    expect(mocks.removeObjectsQuietly).not.toHaveBeenCalled();
  });
});

describe("removeAiEventArtifacts", () => {
  it("removes every object under the event prefix", async () => {
    mocks.listObjectEntries.mockResolvedValue([
      { path: "events/ev1/cert-g1.jpg", createdAt: null },
      { path: "events/ev1/cert-g1-thumb.jpg", createdAt: null },
      { path: "events/ev1/logo-aaaaaaaaaaaaaaaa.png", createdAt: null },
      { path: "events/ev1/upload-bbbbbbbbbbbbbbbb.png", createdAt: null },
    ]);
    await removeAiEventArtifacts("ev1");
    expect(mocks.listObjectEntries).toHaveBeenCalledWith("ai-generations", "events/ev1");
    expect(mocks.removeObjects).toHaveBeenCalledWith("ai-generations", [
      "events/ev1/cert-g1.jpg",
      "events/ev1/cert-g1-thumb.jpg",
      "events/ev1/logo-aaaaaaaaaaaaaaaa.png",
      "events/ev1/upload-bbbbbbbbbbbbbbbb.png",
    ]);
  });

  it("reports instead of throwing so event deletion is never blocked", async () => {
    mocks.listObjectEntries.mockRejectedValue(new Error("down"));
    await expect(removeAiEventArtifacts("ev1")).resolves.toBeUndefined();
    expect(mocks.reportCleanupFailure).toHaveBeenCalledWith("event.delete.ai", expect.any(Error), { eventId: "ev1" });
  });
});
