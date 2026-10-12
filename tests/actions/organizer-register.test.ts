import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recordError: vi.fn(async () => undefined),
  requireUser: vi.fn(),
  upsert: vi.fn(),
  setFlash: vi.fn(),
}));

vi.mock("next/navigation", async () => (await import("../mocks/next-navigation")).nextNavigationMock);
vi.mock("@/server/error-log", () => ({ recordError: mocks.recordError }));
vi.mock("@/server/authz", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/server/db", () => ({ prisma: { organizerProfile: { upsert: mocks.upsert } } }));
vi.mock("@/server/flash", () => ({ setFlash: mocks.setFlash }));

const { ACTION_ERROR_MESSAGE } = await import("@/actions/_lib/handle-action-error");
const { registerOrganizer } = await import("@/actions/organizer-register");

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const valid = { orgName: "HIMA Informatika", contactPhone: "081234567890", contactEmail: "hima@kampus.test" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUser.mockResolvedValue({ id: "u1", role: "ORGANIZER" });
});

describe("registerOrganizer", () => {
  it("rethrows the login redirect when there is no session", async () => {
    mocks.requireUser.mockRejectedValue(new Error("REDIRECT:/organizer/login"));
    await expect(registerOrganizer({}, form(valid))).rejects.toThrow("REDIRECT:/organizer/login");
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.recordError).not.toHaveBeenCalled();
  });

  it("refuses accounts that are not organizers", async () => {
    mocks.requireUser.mockResolvedValue({ id: "u1", role: "PARTICIPANT" });
    const state = await registerOrganizer({}, form(valid));
    expect(state.message).toBeTruthy();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("returns field errors and the typed values when validation fails", async () => {
    const state = await registerOrganizer({}, form({ ...valid, orgName: "" }));
    expect(state.errors?.orgName?.length).toBeGreaterThan(0);
    expect(state.values).toEqual({ ...valid, orgName: "" });
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("creates the profile for the session user and redirects", async () => {
    await expect(registerOrganizer({}, form(valid))).rejects.toThrow(/^REDIRECT:/);
    expect(mocks.upsert.mock.calls[0][0]).toMatchObject({ where: { userId: "u1" }, create: { userId: "u1", orgName: valid.orgName } });
    expect(mocks.setFlash).toHaveBeenCalledWith("organizer-created");
    expect(mocks.recordError).not.toHaveBeenCalled();
  });

  it("returns a friendly message with the typed values and records an unexpected failure", async () => {
    const failure = new Error("db down");
    mocks.upsert.mockRejectedValue(failure);
    const state = await registerOrganizer({}, form(valid));
    expect(state).toEqual({ message: ACTION_ERROR_MESSAGE, values: valid });
    expect(mocks.recordError).toHaveBeenCalledWith({ source: "action.registerOrganizer", error: failure });
  });
});
