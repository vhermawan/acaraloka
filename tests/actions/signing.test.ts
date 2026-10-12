import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recordError: vi.fn(async () => undefined),
  findSignerByToken: vi.fn(),
  signWithToken: vi.fn(),
  declineWithToken: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "user-agent": "vitest", "x-forwarded-for": "203.0.113.5, 10.0.0.1" }),
}));
vi.mock("next/navigation", async () => (await import("../mocks/next-navigation")).nextNavigationMock);
vi.mock("@/server/error-log", () => ({ recordError: mocks.recordError }));
vi.mock("@/server/signers", () => ({
  findSignerByToken: mocks.findSignerByToken,
  signWithToken: mocks.signWithToken,
  declineWithToken: mocks.declineWithToken,
}));

const { ACTION_ERROR_MESSAGE } = await import("@/actions/_lib/handle-action-error");
const { submitSignature, declineSigning } = await import("@/actions/signing");

const PNG_URL = `data:image/png;base64,${Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(80, 1),
]).toString("base64")}`;

beforeEach(() => {
  vi.clearAllMocks();
  for (const mock of [mocks.findSignerByToken, mocks.signWithToken, mocks.declineWithToken]) mock.mockReset();
  mocks.findSignerByToken.mockResolvedValue({ eventId: "e1" });
});

describe("submitSignature", () => {
  it("requires consent before querying", async () => {
    expect(await submitSignature("token", PNG_URL, false)).toHaveProperty("error");
    expect(mocks.signWithToken).not.toHaveBeenCalled();
  });

  it("rejects an unreadable image before querying", async () => {
    expect(await submitSignature("token", "data:text/plain;base64,AAAA", true)).toHaveProperty("error");
    expect(mocks.signWithToken).not.toHaveBeenCalled();
  });

  it("answers an invalid link with the generic link error", async () => {
    mocks.signWithToken.mockResolvedValue({ ok: false });
    expect((await submitSignature("salah", PNG_URL, true)).error).toMatch(/tidak berlaku/);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("signs with the first forwarded IP and revalidates the organizer page", async () => {
    mocks.signWithToken.mockResolvedValue({ ok: true });
    expect(await submitSignature("token", PNG_URL, true)).toEqual({});
    expect(mocks.signWithToken).toHaveBeenCalledWith(
      expect.objectContaining({ token: "token", ip: "203.0.113.5", userAgent: "vitest" }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/organizer/events/e1/certificate");
  });

  it("returns a friendly error and records an unexpected failure", async () => {
    const failure = new Error("db down");
    mocks.signWithToken.mockRejectedValue(failure);
    expect(await submitSignature("token", PNG_URL, true)).toEqual({ error: ACTION_ERROR_MESSAGE });
    expect(mocks.recordError).toHaveBeenCalledWith({ source: "action.submitSignature", error: failure });
  });
});

describe("declineSigning", () => {
  it("rejects an empty reason before querying", async () => {
    expect(await declineSigning("token", " ")).toHaveProperty("error");
    expect(mocks.declineWithToken).not.toHaveBeenCalled();
  });

  it("answers an invalid link with the generic link error", async () => {
    mocks.declineWithToken.mockResolvedValue(false);
    expect((await declineSigning("salah", "Saya tidak berwenang")).error).toMatch(/tidak berlaku/);
  });

  it("declines with the trimmed reason and revalidates", async () => {
    mocks.declineWithToken.mockResolvedValue(true);
    expect(await declineSigning("token", " Saya tidak berwenang ")).toEqual({});
    expect(mocks.declineWithToken).toHaveBeenCalledWith({ token: "token", reason: "Saya tidak berwenang" });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/organizer/events/e1/certificate");
  });

  it("returns a friendly error and records an unexpected failure", async () => {
    const failure = new Error("db down");
    mocks.declineWithToken.mockRejectedValue(failure);
    expect(await declineSigning("token", "Saya tidak berwenang")).toEqual({ error: ACTION_ERROR_MESSAGE });
    expect(mocks.recordError).toHaveBeenCalledWith({ source: "action.declineSigning", error: failure });
  });
});
