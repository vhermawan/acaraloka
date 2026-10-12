import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recordError: vi.fn(async () => undefined),
  requireEventOwner: vi.fn(),
  requireOrganizer: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  prune: vi.fn(),
  removeAi: vi.fn(),
  reportCleanupFailure: vi.fn(async () => undefined),
  create: vi.fn(),
  count: vi.fn(),
  updateMany: vi.fn(),
  cancelEvent: vi.fn(),
  signedUpload: vi.fn(),
  revalidatePath: vi.fn(),
  scheduleEmailDrain: vi.fn(),
}));

vi.mock("next/navigation", async () => (await import("../mocks/next-navigation")).nextNavigationMock);
vi.mock("@/server/error-log", () => ({ recordError: mocks.recordError }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/server/flash", () => ({ setFlash: vi.fn() }));
vi.mock("@/server/authz", () => ({
  requireEventOwner: mocks.requireEventOwner,
  requireOrganizer: mocks.requireOrganizer,
}));
vi.mock("@/server/db", () => ({
  prisma: {
    event: { update: mocks.update, delete: mocks.remove, create: mocks.create, updateMany: mocks.updateMany },
    ticketType: { count: mocks.count },
  },
}));
vi.mock("@/server/storage", () => ({
  POSTER_BUCKET: "posters",
  createSignedUploadUrl: mocks.signedUpload,
  removeObjects: async () => undefined,
}));
vi.mock("@/server/storage-cleanup", () => ({
  removeObjectsQuietly: async () => undefined,
  reportCleanupFailure: mocks.reportCleanupFailure,
}));
vi.mock("@/server/cancellation", () => ({ cancelEvent: mocks.cancelEvent }));
vi.mock("@/server/email-schedule", () => ({ scheduleEmailDrain: mocks.scheduleEmailDrain }));
vi.mock("@/server/certificate-config", () => ({ pruneCertificateBackgrounds: mocks.prune }));
vi.mock("@/server/ai/artifacts", () => ({ removeAiEventArtifacts: mocks.removeAi }));

const { ACTION_ERROR_MESSAGE } = await import("@/actions/_lib/handle-action-error");
const { createEvent, updateEvent, deleteEvent, setEventPoster, createPosterUpload, publishEvent, cancelEventAction } = await import(
  "@/actions/organizer-events"
);

function formData(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.append(key, value);
  return data;
}

const validForm = {
  title: "Workshop Next.js",
  description: "Belajar App Router dari nol sampai deploy.",
  timezone: "Asia/Jakarta",
  startAt: "2026-11-01T09:00",
  endAt: "2026-11-01T12:00",
  locationType: "OFFLINE",
  venueName: "Aula Kampus A",
  venueAddress: "",
  placeId: "",
  onlineUrl: "",
};

beforeEach(() => {
  vi.clearAllMocks();
  for (const mock of [mocks.update, mocks.remove, mocks.create, mocks.count, mocks.cancelEvent]) mock.mockReset();
  mocks.removeAi.mockReset();
  mocks.signedUpload.mockImplementation(async (_bucket: string, path: string) => `https://storage.test/${path}?token=t`);
});

describe("event actions authorization", () => {
  it("does not update when the caller is not the owner", async () => {
    mocks.requireEventOwner.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(updateEvent("e1", {}, formData(validForm))).rejects.toThrow("NOT_FOUND");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("updates for the owner", async () => {
    mocks.requireEventOwner.mockResolvedValue({ event: { id: "e1", status: "DRAFT" } });
    const result = await updateEvent("e1", {}, formData(validForm));
    expect(result.savedAt).toBeDefined();
    expect(mocks.update).toHaveBeenCalledOnce();
  });

  it("refuses to delete published events", async () => {
    mocks.requireEventOwner.mockResolvedValue({ event: { id: "e1", status: "PUBLISHED" } });
    await expect(deleteEvent("e1")).resolves.toEqual({ error: "Hanya acara draf yang bisa dihapus." });
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("deletes every certificate background of a deleted draft event", async () => {
    mocks.requireEventOwner.mockResolvedValue({ event: { id: "e1", status: "DRAFT", posterPath: null } });
    mocks.remove.mockResolvedValue(undefined);
    await expect(deleteEvent("e1")).rejects.toThrow("REDIRECT:/organizer");
    expect(mocks.prune).toHaveBeenCalledWith("e1", null);
  });

  it("removes the AI generation files of a deleted draft event", async () => {
    mocks.requireEventOwner.mockResolvedValue({ event: { id: "e1", status: "DRAFT", posterPath: null } });
    mocks.remove.mockResolvedValue(undefined);
    await expect(deleteEvent("e1")).rejects.toThrow("REDIRECT:/organizer");
    expect(mocks.removeAi).toHaveBeenCalledWith("e1");
  });

  it("does not touch AI files when the event cannot be deleted", async () => {
    mocks.requireEventOwner.mockResolvedValue({ event: { id: "e1", status: "PUBLISHED" } });
    await deleteEvent("e1");
    expect(mocks.removeAi).not.toHaveBeenCalled();
  });

  it("rejects poster paths outside the event folder", async () => {
    mocks.requireEventOwner.mockResolvedValue({ event: { id: "e1", status: "DRAFT", posterPath: null } });
    await expect(setEventPoster("e1", "events/e2/x.png")).resolves.toHaveProperty("error");
    await expect(setEventPoster("e1", "events/e1/../e2/x.png")).resolves.toHaveProperty("error");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("creates signed upload paths under the event folder", async () => {
    mocks.requireEventOwner.mockResolvedValue({ event: { id: "e1", status: "DRAFT" } });
    const result = await createPosterUpload("e1", { contentType: "image/png", size: 1000 });
    expect(result).toMatchObject({ path: expect.stringMatching(/^events\/e1\/[0-9a-f]{16}\.png$/) });
  });
});

describe("createEvent", () => {
  it("rethrows the guard signal for non-organizers", async () => {
    mocks.requireOrganizer.mockRejectedValue(new Error("REDIRECT:/organizer/login"));
    await expect(createEvent({}, formData(validForm))).rejects.toThrow("REDIRECT:/organizer/login");
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.recordError).not.toHaveBeenCalled();
  });

  it("returns field errors and keeps the values when validation fails", async () => {
    mocks.requireOrganizer.mockResolvedValue({ user: { id: "u1" } });
    const result = await createEvent({}, formData({ ...validForm, title: "" }));
    expect(result.errors?.title?.length).toBeGreaterThan(0);
    expect(result.values?.venueName).toBe("Aula Kampus A");
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("creates the event for the session organizer and redirects", async () => {
    mocks.requireOrganizer.mockResolvedValue({ user: { id: "u1" } });
    mocks.create.mockResolvedValue({ id: "e9" });
    await expect(createEvent({}, formData(validForm))).rejects.toThrow("REDIRECT:/organizer/events/e9");
    expect(mocks.create.mock.calls[0][0].data).toMatchObject({ organizerId: "u1", title: "Workshop Next.js" });
    expect(mocks.recordError).not.toHaveBeenCalled();
  });

  it("returns a friendly message with the typed values and records an unexpected failure", async () => {
    const failure = new Error("db down");
    mocks.requireOrganizer.mockResolvedValue({ user: { id: "u1" } });
    mocks.create.mockRejectedValue(failure);
    const result = await createEvent({}, formData(validForm));
    expect(result.message).toBe(ACTION_ERROR_MESSAGE);
    expect(result.values?.title).toBe("Workshop Next.js");
    expect(mocks.recordError).toHaveBeenCalledWith({ source: "action.createEvent", error: failure });
  });
});

describe("updateEvent", () => {
  it("refuses cancelled events", async () => {
    mocks.requireEventOwner.mockResolvedValue({ event: { id: "e1", status: "CANCELLED" } });
    const result = await updateEvent("e1", {}, formData(validForm));
    expect(result.message).toMatch(/tidak bisa diubah/);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("returns field errors when validation fails", async () => {
    mocks.requireEventOwner.mockResolvedValue({ event: { id: "e1", status: "DRAFT" } });
    const result = await updateEvent("e1", {}, formData({ ...validForm, title: "" }));
    expect(result.errors?.title?.length).toBeGreaterThan(0);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("returns a friendly message and records an unexpected failure", async () => {
    const failure = new Error("db down");
    mocks.requireEventOwner.mockResolvedValue({ event: { id: "e1", status: "DRAFT" } });
    mocks.update.mockRejectedValue(failure);
    const result = await updateEvent("e1", {}, formData(validForm));
    expect(result.message).toBe(ACTION_ERROR_MESSAGE);
    expect(result.values?.title).toBe("Workshop Next.js");
    expect(mocks.recordError).toHaveBeenCalledWith({ source: "action.updateEvent", error: failure });
  });
});

describe("deleteEvent failures", () => {
  it("returns a friendly error and records an unexpected failure", async () => {
    const failure = new Error("db down");
    mocks.requireEventOwner.mockResolvedValue({ event: { id: "e1", status: "DRAFT", posterPath: null } });
    mocks.remove.mockRejectedValue(failure);
    expect(await deleteEvent("e1")).toEqual({ error: ACTION_ERROR_MESSAGE });
    expect(mocks.recordError).toHaveBeenCalledWith({ source: "action.deleteEvent", error: failure });
  });

  it("still redirects and only reports when post-delete cleanup throws", async () => {
    const failure = new Error("storage down");
    mocks.requireEventOwner.mockResolvedValue({ event: { id: "e1", status: "DRAFT", posterPath: null } });
    mocks.remove.mockResolvedValue(undefined);
    mocks.removeAi.mockRejectedValue(failure);
    await expect(deleteEvent("e1")).rejects.toThrow("REDIRECT:/organizer");
    expect(mocks.reportCleanupFailure).toHaveBeenCalledWith("event.delete.cleanup", failure, { eventId: "e1" });
    expect(mocks.recordError).not.toHaveBeenCalled();
  });

  it("does not log the redirect after a successful delete", async () => {
    mocks.requireEventOwner.mockResolvedValue({ event: { id: "e1", status: "DRAFT", posterPath: null } });
    mocks.remove.mockResolvedValue(undefined);
    await expect(deleteEvent("e1")).rejects.toThrow("REDIRECT:/organizer");
    expect(mocks.recordError).not.toHaveBeenCalled();
  });
});

describe("poster actions", () => {
  it("rejects invalid poster files before signing", async () => {
    mocks.requireEventOwner.mockResolvedValue({ event: { id: "e1", status: "DRAFT" } });
    const result = await createPosterUpload("e1", { contentType: "application/pdf", size: 1000 });
    expect(result).toHaveProperty("error");
    expect(mocks.signedUpload).not.toHaveBeenCalled();
  });

  it("refuses poster changes on closed events", async () => {
    mocks.requireEventOwner.mockResolvedValue({ event: { id: "e1", status: "CANCELLED" } });
    expect(await createPosterUpload("e1", { contentType: "image/png", size: 1000 })).toEqual({
      error: "Poster acara ini tidak bisa diubah.",
    });
    expect(await setEventPoster("e1", "events/e1/x.png")).toEqual({ error: "Poster acara ini tidak bisa diubah." });
  });

  it("stores the poster path and revalidates", async () => {
    mocks.requireEventOwner.mockResolvedValue({ event: { id: "e1", status: "DRAFT", posterPath: null } });
    expect(await setEventPoster("e1", "events/e1/x.png")).toEqual({});
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: "e1" }, data: { posterPath: "events/e1/x.png" } });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/organizer/events/e1");
  });

  it("returns a friendly error and records an unexpected failure when signing", async () => {
    const failure = new Error("storage down");
    mocks.requireEventOwner.mockResolvedValue({ event: { id: "e1", status: "DRAFT" } });
    mocks.signedUpload.mockRejectedValue(failure);
    expect(await createPosterUpload("e1", { contentType: "image/png", size: 1000 })).toEqual({ error: ACTION_ERROR_MESSAGE });
    expect(mocks.recordError).toHaveBeenCalledWith({ source: "action.createPosterUpload", error: failure });
  });

  it("returns a friendly error and records an unexpected failure when saving", async () => {
    const failure = new Error("db down");
    mocks.requireEventOwner.mockResolvedValue({ event: { id: "e1", status: "DRAFT", posterPath: null } });
    mocks.update.mockRejectedValue(failure);
    expect(await setEventPoster("e1", "events/e1/x.png")).toEqual({ error: ACTION_ERROR_MESSAGE });
    expect(mocks.recordError).toHaveBeenCalledWith({ source: "action.setEventPoster", error: failure });
  });
});

describe("publishEvent", () => {
  const draft = { id: "e1", slug: "acara", status: "DRAFT" };

  it("reports publish issues without updating", async () => {
    mocks.requireEventOwner.mockResolvedValue({ event: { ...draft, title: "" } });
    mocks.count.mockResolvedValue(0);
    const result = await publishEvent("e1");
    expect(result.error).toBeTruthy();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("returns a friendly error and records an unexpected failure", async () => {
    const failure = new Error("db down");
    mocks.requireEventOwner.mockResolvedValue({ event: draft });
    mocks.count.mockRejectedValue(failure);
    expect(await publishEvent("e1")).toEqual({ error: ACTION_ERROR_MESSAGE });
    expect(mocks.recordError).toHaveBeenCalledWith({ source: "action.publishEvent", error: failure });
  });
});

describe("cancelEventAction", () => {
  const published = { id: "e1", slug: "acara", status: "PUBLISHED", title: "Workshop Next.js" };

  it("rejects when the confirmation title does not match", async () => {
    mocks.requireEventOwner.mockResolvedValue({ event: published });
    const result = await cancelEventAction("e1", {}, formData({ reason: "Pembicara berhalangan hadir", confirmTitle: "salah" }));
    expect(result.errors?.confirmTitle?.length).toBeGreaterThan(0);
    expect(mocks.cancelEvent).not.toHaveBeenCalled();
  });

  it("reports an event that can no longer be cancelled", async () => {
    mocks.requireEventOwner.mockResolvedValue({ event: published });
    mocks.cancelEvent.mockResolvedValue(false);
    const result = await cancelEventAction(
      "e1",
      {},
      formData({ reason: "Pembicara berhalangan hadir", confirmTitle: "Workshop Next.js" }),
    );
    expect(result.message).toMatch(/Hanya acara terbit/);
  });

  it("cancels, schedules emails and redirects", async () => {
    mocks.requireEventOwner.mockResolvedValue({ event: published });
    mocks.cancelEvent.mockResolvedValue(true);
    await expect(
      cancelEventAction("e1", {}, formData({ reason: "Pembicara berhalangan hadir", confirmTitle: "Workshop Next.js" })),
    ).rejects.toThrow("REDIRECT:/organizer/events/e1");
    expect(mocks.cancelEvent).toHaveBeenCalledWith({ eventId: "e1", reason: "Pembicara berhalangan hadir" });
    expect(mocks.scheduleEmailDrain).toHaveBeenCalled();
    expect(mocks.recordError).not.toHaveBeenCalled();
  });

  it("returns a friendly message with the typed values and records an unexpected failure", async () => {
    const failure = new Error("db down");
    mocks.requireEventOwner.mockResolvedValue({ event: published });
    mocks.cancelEvent.mockRejectedValue(failure);
    const result = await cancelEventAction(
      "e1",
      {},
      formData({ reason: "Pembicara berhalangan hadir", confirmTitle: "Workshop Next.js" }),
    );
    expect(result.message).toBe(ACTION_ERROR_MESSAGE);
    expect(result.values?.reason).toBe("Pembicara berhalangan hadir");
    expect(mocks.recordError).toHaveBeenCalledWith({ source: "action.cancelEventAction", error: failure });
  });
});
