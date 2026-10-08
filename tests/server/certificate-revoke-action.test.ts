import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireEventOwner: vi.fn(),
  revokeCertificate: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/authz", () => ({ requireEventOwner: mocks.requireEventOwner }));
vi.mock("@/server/certificates", () => ({
  issueCertificates: vi.fn(),
  revokeCertificate: mocks.revokeCertificate,
}));
vi.mock("@/server/signers", () => ({
  addSigner: vi.fn(),
  regenerateSignerLink: vi.fn(),
  removeSigner: vi.fn(),
  unlockCertificate: vi.fn(),
}));
vi.mock("@/server/certificate-config", () => ({ saveCertificateLayout: vi.fn() }));
vi.mock("@/server/db", () => ({ prisma: {} }));

const { revokeEventCertificate } = await import("@/app/organizer/events/[id]/certificate/actions");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("revokeEventCertificate", () => {
  it("does not revoke when the caller is not the event owner", async () => {
    mocks.requireEventOwner.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(revokeEventCertificate("e1", "c1", "Nama salah ketik")).rejects.toThrow("NOT_FOUND");
    expect(mocks.revokeCertificate).not.toHaveBeenCalled();
  });

  it("requires a reason", async () => {
    mocks.requireEventOwner.mockResolvedValue({ user: { id: "u1" }, event: { id: "e1" } });
    expect(await revokeEventCertificate("e1", "c1", "  ")).toHaveProperty("error");
    expect(mocks.revokeCertificate).not.toHaveBeenCalled();
  });

  it("passes the trimmed reason and owner to the revoke function", async () => {
    mocks.requireEventOwner.mockResolvedValue({ user: { id: "u1" }, event: { id: "e1" } });
    mocks.revokeCertificate.mockResolvedValue({ ok: true });
    expect(await revokeEventCertificate("e1", "c1", " Nama salah ketik ")).toEqual({});
    expect(mocks.revokeCertificate).toHaveBeenCalledWith({
      eventId: "e1",
      certificateId: "c1",
      actorId: "u1",
      reason: "Nama salah ketik",
    });
  });

  it("reports an already revoked certificate", async () => {
    mocks.requireEventOwner.mockResolvedValue({ user: { id: "u1" }, event: { id: "e1" } });
    mocks.revokeCertificate.mockResolvedValue({ ok: false, reason: "ALREADY_REVOKED" });
    expect(await revokeEventCertificate("e1", "c1", "Nama salah ketik")).toEqual({ error: "Sertifikat ini sudah dicabut." });
  });
});
