import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  addAiAllowlist: vi.fn(),
  removeAiAllowlist: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/server/authz", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/server/ai-allowlist", () => ({
  addAiAllowlist: mocks.addAiAllowlist,
  removeAiAllowlist: mocks.removeAiAllowlist,
}));

const { addAiAllowlistAction, removeAiAllowlistAction } = await import("@/app/admin/ai/actions");

function form(email: string) {
  const data = new FormData();
  data.set("email", email);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ai allowlist actions for non-admins", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockRejectedValue(new Error("NOT_FOUND"));
  });

  it("blocks adding without touching the database", async () => {
    await expect(addAiAllowlistAction({}, form("a@b.test"))).rejects.toThrow("NOT_FOUND");
    expect(mocks.addAiAllowlist).not.toHaveBeenCalled();
  });

  it("blocks removing without touching the database", async () => {
    await expect(removeAiAllowlistAction("u1")).rejects.toThrow("NOT_FOUND");
    expect(mocks.removeAiAllowlist).not.toHaveBeenCalled();
  });
});

describe("ai allowlist actions for admins", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockResolvedValue({ id: "admin1", role: "ADMIN" });
  });

  it("rejects an invalid email before querying", async () => {
    const result = await addAiAllowlistAction({}, form("bukan-email"));
    expect(result.error).toBe("Email tidak valid.");
    expect(result.values).toEqual({ email: "bukan-email" });
    expect(mocks.addAiAllowlist).not.toHaveBeenCalled();
  });

  it("normalizes the email and passes the session admin as actor", async () => {
    mocks.addAiAllowlist.mockResolvedValue({ ok: true, userId: "u1" });
    const result = await addAiAllowlistAction({}, form("  Panitia@Contoh.TEST "));
    expect(result).toEqual({ done: true });
    expect(mocks.addAiAllowlist).toHaveBeenCalledWith({ email: "panitia@contoh.test", actorId: "admin1" });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/ai");
  });

  it("maps the unknown account and duplicate outcomes to messages", async () => {
    mocks.addAiAllowlist.mockResolvedValueOnce({ ok: false, reason: "NOT_ORGANIZER" });
    expect((await addAiAllowlistAction({}, form("a@b.test"))).error).toBe("Akun dengan email ini belum terdaftar sebagai panitia.");

    mocks.addAiAllowlist.mockResolvedValueOnce({ ok: false, reason: "ALREADY_ALLOWED" });
    expect((await addAiAllowlistAction({}, form("a@b.test"))).error).toBe("Akun ini sudah ada di daftar akses AI.");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("removes with the session admin as actor", async () => {
    mocks.removeAiAllowlist.mockResolvedValue({ ok: true });
    expect(await removeAiAllowlistAction("u1")).toEqual({});
    expect(mocks.removeAiAllowlist).toHaveBeenCalledWith({ userId: "u1", actorId: "admin1" });
  });

  it("reports an account that is not in the allowlist", async () => {
    mocks.removeAiAllowlist.mockResolvedValue({ ok: false, reason: "NOT_ALLOWED" });
    expect((await removeAiAllowlistAction("u1")).error).toBe("Akun ini tidak ada di daftar akses AI.");
  });
});
