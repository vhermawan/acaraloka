import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireEventOwner: vi.fn(),
  requireOrganizer: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/server/authz", () => ({
  requireEventOwner: mocks.requireEventOwner,
  requireOrganizer: mocks.requireOrganizer,
}));
vi.mock("@/server/db", () => ({
  prisma: { event: { update: mocks.update, delete: mocks.remove } },
}));
vi.mock("@/server/storage", () => ({
  POSTER_BUCKET: "posters",
  createSignedUploadUrl: async (_bucket: string, path: string) => `https://storage.test/${path}?token=t`,
  removeObjects: async () => undefined,
}));

const { updateEvent, deleteEvent, setEventPoster, createPosterUpload } = await import(
  "@/app/organizer/events/actions"
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
  venue: "Aula Kampus A",
};

beforeEach(() => {
  vi.clearAllMocks();
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
