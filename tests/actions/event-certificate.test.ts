import { beforeEach, describe, expect, it, vi } from "vitest";

import { defaultCertificateLayout } from "@/lib/certificate-layout";

const mocks = vi.hoisted(() => ({
  recordError: vi.fn(async () => undefined),
  requireEventOwner: vi.fn(),
  revokeCertificate: vi.fn(),
  issueCertificates: vi.fn(),
  addSigner: vi.fn(),
  regenerateSignerLink: vi.fn(),
  removeSigner: vi.fn(),
  unlockCertificate: vi.fn(),
  saveCertificateLayout: vi.fn(),
  getOrCreateCertificateConfig: vi.fn(),
  applyCertificateBackground: vi.fn(),
  clearCertificateBackground: vi.fn(),
  createSignedUploadUrl: vi.fn(),
  scheduleEmailDrain: vi.fn(),
  revalidatePath: vi.fn(),
  env: { APP_BASE_URL: "https://acaraloka.test", EMAIL_ENABLED: true },
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", async () => (await import("../mocks/next-navigation")).nextNavigationMock);
vi.mock("@/server/error-log", () => ({ recordError: mocks.recordError }));
vi.mock("@/lib/env", () => ({ env: mocks.env }));
vi.mock("@/server/authz", () => ({ requireEventOwner: mocks.requireEventOwner }));
vi.mock("@/server/certificates", () => ({
  issueCertificates: mocks.issueCertificates,
  revokeCertificate: mocks.revokeCertificate,
}));
vi.mock("@/server/signers", () => ({
  addSigner: mocks.addSigner,
  regenerateSignerLink: mocks.regenerateSignerLink,
  removeSigner: mocks.removeSigner,
  unlockCertificate: mocks.unlockCertificate,
}));
vi.mock("@/server/certificate-config", () => ({
  BACKGROUND_LOCKED_MESSAGE: "Desain terkunci.",
  saveCertificateLayout: mocks.saveCertificateLayout,
  getOrCreateCertificateConfig: mocks.getOrCreateCertificateConfig,
  applyCertificateBackground: mocks.applyCertificateBackground,
  clearCertificateBackground: mocks.clearCertificateBackground,
}));
vi.mock("@/server/email-schedule", () => ({ scheduleEmailDrain: mocks.scheduleEmailDrain }));
vi.mock("@/server/storage", () => ({
  CERTIFICATE_BACKGROUND_BUCKET: "certificate-backgrounds",
  createSignedUploadUrl: mocks.createSignedUploadUrl,
}));

const { ACTION_ERROR_MESSAGE } = await import("@/actions/_lib/handle-action-error");
const actions = await import("@/actions/event-certificate");

const owner = { user: { id: "u1" }, event: { id: "e1", status: "PUBLISHED" } };
const closed = { user: { id: "u1" }, event: { id: "e1", status: "CANCELLED" } };
const disabled = { user: { id: "u1" }, event: { id: "e1", status: "DISABLED" } };

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const signer = { name: "Dr. Siti", title: "Ketua Panitia", email: "siti@kampus.test" };
const upload = { contentType: "image/png", size: 1000, width: 2480, height: 1754 };

beforeEach(() => {
  vi.clearAllMocks();
  for (const mock of [
    mocks.revokeCertificate,
    mocks.issueCertificates,
    mocks.addSigner,
    mocks.regenerateSignerLink,
    mocks.removeSigner,
    mocks.unlockCertificate,
    mocks.saveCertificateLayout,
    mocks.getOrCreateCertificateConfig,
    mocks.applyCertificateBackground,
    mocks.clearCertificateBackground,
    mocks.createSignedUploadUrl,
  ]) {
    mock.mockReset();
  }
  mocks.env.EMAIL_ENABLED = true;
  mocks.requireEventOwner.mockResolvedValue(owner);
});

describe("certificate actions for non-owners", () => {
  it("rethrow the guard signal and change nothing", async () => {
    mocks.requireEventOwner.mockRejectedValue(new Error("NOT_FOUND"));
    const calls = [
      actions.saveLayout("e1", defaultCertificateLayout()),
      actions.createBackgroundUpload("e1", upload),
      actions.applyBackground("e1", "events/e1/0123456789abcdef.png"),
      actions.removeBackground("e1"),
      actions.createSigner("e1", {}, form(signer)),
      actions.regenerateLink("e1", "s1"),
      actions.emailSignerLink("e1", "s1"),
      actions.deleteSigner("e1", "s1"),
      actions.unlockDesign("e1"),
      actions.issueEventCertificates("e1"),
      actions.revokeEventCertificate("e1", "c1", "Nama salah ketik"),
    ];
    for (const call of calls) await expect(call).rejects.toThrow("NOT_FOUND");
    expect(mocks.saveCertificateLayout).not.toHaveBeenCalled();
    expect(mocks.addSigner).not.toHaveBeenCalled();
    expect(mocks.issueCertificates).not.toHaveBeenCalled();
    expect(mocks.revokeCertificate).not.toHaveBeenCalled();
    expect(mocks.recordError).not.toHaveBeenCalled();
  });
});

describe("saveLayout", () => {
  it("saves a valid layout for the guarded event and revalidates", async () => {
    mocks.saveCertificateLayout.mockResolvedValue(true);
    expect(await actions.saveLayout("e1", defaultCertificateLayout())).toEqual({});
    expect(mocks.saveCertificateLayout).toHaveBeenCalledWith("e1", expect.any(Object));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/organizer/events/e1/certificate");
  });

  it("refuses disabled events and invalid layouts", async () => {
    mocks.requireEventOwner.mockResolvedValueOnce(disabled);
    expect(await actions.saveLayout("e1", defaultCertificateLayout())).toEqual({ error: "Acara ini dinonaktifkan admin." });
    expect((await actions.saveLayout("e1", {})).error).toMatch(/tidak valid/);
    expect(mocks.saveCertificateLayout).not.toHaveBeenCalled();
  });

  it("reports a locked design", async () => {
    mocks.saveCertificateLayout.mockResolvedValue(false);
    expect((await actions.saveLayout("e1", defaultCertificateLayout())).error).toMatch(/terkunci/);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns a friendly error and records an unexpected failure", async () => {
    const failure = new Error("db down");
    mocks.saveCertificateLayout.mockRejectedValue(failure);
    expect(await actions.saveLayout("e1", defaultCertificateLayout())).toEqual({ error: ACTION_ERROR_MESSAGE });
    expect(mocks.recordError).toHaveBeenCalledWith({ source: "action.saveLayout", error: failure });
  });
});

describe("background actions", () => {
  it("signs an upload path under the guarded event", async () => {
    mocks.getOrCreateCertificateConfig.mockResolvedValue({ lockedAt: null });
    mocks.createSignedUploadUrl.mockResolvedValue("https://storage.test/u");
    const result = await actions.createBackgroundUpload("e1", upload);
    expect(result).toMatchObject({ uploadUrl: "https://storage.test/u", path: expect.stringMatching(/^events\/e1\/[0-9a-f]{16}\.png$/) });
  });

  it("refuses uploads for closed events, locked designs and invalid files", async () => {
    mocks.requireEventOwner.mockResolvedValueOnce(closed);
    expect(await actions.createBackgroundUpload("e1", upload)).toEqual({ error: "Acara ini sudah ditutup." });

    mocks.getOrCreateCertificateConfig.mockResolvedValue({ lockedAt: new Date() });
    expect(await actions.createBackgroundUpload("e1", upload)).toEqual({ error: "Desain terkunci." });

    mocks.getOrCreateCertificateConfig.mockResolvedValue({ lockedAt: null });
    expect(await actions.createBackgroundUpload("e1", { ...upload, contentType: "image/gif" })).toHaveProperty("error");
    expect(await actions.createBackgroundUpload("e1", { ...upload, width: 100, height: 100 })).toHaveProperty("error");
    expect(mocks.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("applies and removes backgrounds for the guarded event", async () => {
    mocks.applyCertificateBackground.mockResolvedValue({ ok: true });
    mocks.clearCertificateBackground.mockResolvedValue({ ok: true });
    expect(await actions.applyBackground("e1", "events/e1/0123456789abcdef.png")).toEqual({});
    expect(mocks.applyCertificateBackground).toHaveBeenCalledWith("e1", "events/e1/0123456789abcdef.png");
    expect(await actions.removeBackground("e1")).toEqual({});
    expect(mocks.clearCertificateBackground).toHaveBeenCalledWith("e1");
  });

  it("passes denials through and refuses closed events", async () => {
    mocks.applyCertificateBackground.mockResolvedValue({ ok: false, error: "Berkas tidak valid." });
    mocks.clearCertificateBackground.mockResolvedValue({ ok: false });
    expect(await actions.applyBackground("e1", "x")).toEqual({ error: "Berkas tidak valid." });
    expect(await actions.removeBackground("e1")).toEqual({ error: "Desain terkunci." });
    mocks.requireEventOwner.mockResolvedValue(closed);
    expect(await actions.applyBackground("e1", "x")).toEqual({ error: "Acara ini sudah ditutup." });
    expect(await actions.removeBackground("e1")).toEqual({ error: "Acara ini sudah ditutup." });
  });

  it("returns a friendly error and records unexpected failures", async () => {
    const failure = new Error("storage down");
    mocks.getOrCreateCertificateConfig.mockRejectedValue(failure);
    mocks.applyCertificateBackground.mockRejectedValue(failure);
    mocks.clearCertificateBackground.mockRejectedValue(failure);
    expect(await actions.createBackgroundUpload("e1", upload)).toEqual({ error: ACTION_ERROR_MESSAGE });
    expect(await actions.applyBackground("e1", "x")).toEqual({ error: ACTION_ERROR_MESSAGE });
    expect(await actions.removeBackground("e1")).toEqual({ error: ACTION_ERROR_MESSAGE });
    expect(mocks.recordError.mock.calls.map((call) => (call[0] as { source: string }).source)).toEqual([
      "action.createBackgroundUpload",
      "action.applyBackground",
      "action.removeBackground",
    ]);
  });
});

describe("createSigner", () => {
  it("adds a signer, schedules the invite and returns the signing link", async () => {
    mocks.addSigner.mockResolvedValue({ ok: true, token: "tok", emailed: true });
    const state = await actions.createSigner("e1", {}, form(signer));
    expect(mocks.addSigner).toHaveBeenCalledWith({ eventId: "e1", ...signer });
    expect(state.link).toMatchObject({ signerName: "Dr. Siti", url: "https://acaraloka.test/sign/tok", emailedTo: "siti@kampus.test" });
    expect(mocks.scheduleEmailDrain).toHaveBeenCalled();
  });

  it("refuses closed events", async () => {
    mocks.requireEventOwner.mockResolvedValue(closed);
    expect((await actions.createSigner("e1", {}, form(signer))).message).toBe("Acara ini sudah ditutup.");
    expect(mocks.addSigner).not.toHaveBeenCalled();
  });

  it("returns field errors and the typed values", async () => {
    const state = await actions.createSigner("e1", {}, form({ ...signer, email: "bukan-email" }));
    expect(state.errors?.email?.length).toBeGreaterThan(0);
    expect(state.values?.name).toBe("Dr. Siti");
    expect(mocks.addSigner).not.toHaveBeenCalled();
  });

  it.each([
    ["FULL", /Maksimal 3/],
    ["LOCKED", /terkunci/],
  ])("reports %s", async (reason, pattern) => {
    mocks.addSigner.mockResolvedValue({ ok: false, reason });
    expect((await actions.createSigner("e1", {}, form(signer))).message).toMatch(pattern);
  });

  it("returns a friendly message with the typed values and records an unexpected failure", async () => {
    const failure = new Error("db down");
    mocks.addSigner.mockRejectedValue(failure);
    expect(await actions.createSigner("e1", {}, form(signer))).toEqual({ message: ACTION_ERROR_MESSAGE, values: signer });
    expect(mocks.recordError).toHaveBeenCalledWith({ source: "action.createSigner", error: failure });
  });
});

describe("signer link actions", () => {
  it("regenerates a link with the guarded event and actor", async () => {
    mocks.regenerateSignerLink.mockResolvedValue("tok2");
    expect(await actions.regenerateLink("e1", "s1")).toEqual({ url: "https://acaraloka.test/sign/tok2" });
    expect(mocks.regenerateSignerLink).toHaveBeenCalledWith({ eventId: "e1", signerId: "s1", actorId: "u1" });
  });

  it("refuses a signer that already signed", async () => {
    mocks.regenerateSignerLink.mockResolvedValue(null);
    expect((await actions.regenerateLink("e1", "s1")).error).toMatch(/sudah tanda tangan/);
    expect((await actions.emailSignerLink("e1", "s1")).error).toMatch(/sudah tanda tangan/);
  });

  it("emails the link and schedules the drain", async () => {
    mocks.regenerateSignerLink.mockResolvedValue("tok2");
    expect(await actions.emailSignerLink("e1", "s1")).toEqual({});
    expect(mocks.regenerateSignerLink).toHaveBeenCalledWith({ eventId: "e1", signerId: "s1", actorId: "u1", sendEmail: true });
    expect(mocks.scheduleEmailDrain).toHaveBeenCalled();
  });

  it("refuses emailing when email is off or the event is closed", async () => {
    mocks.env.EMAIL_ENABLED = false;
    expect((await actions.emailSignerLink("e1", "s1")).error).toMatch(/belum aktif/);
    mocks.env.EMAIL_ENABLED = true;
    mocks.requireEventOwner.mockResolvedValue(closed);
    expect(await actions.emailSignerLink("e1", "s1")).toEqual({ error: "Acara ini sudah ditutup." });
    expect(await actions.regenerateLink("e1", "s1")).toEqual({ error: "Acara ini sudah ditutup." });
    expect(mocks.regenerateSignerLink).not.toHaveBeenCalled();
  });

  it("returns a friendly error and records unexpected failures", async () => {
    const failure = new Error("db down");
    mocks.regenerateSignerLink.mockRejectedValue(failure);
    expect(await actions.regenerateLink("e1", "s1")).toEqual({ error: ACTION_ERROR_MESSAGE });
    expect(await actions.emailSignerLink("e1", "s1")).toEqual({ error: ACTION_ERROR_MESSAGE });
    expect(mocks.recordError).toHaveBeenCalledWith({ source: "action.regenerateLink", error: failure });
    expect(mocks.recordError).toHaveBeenCalledWith({ source: "action.emailSignerLink", error: failure });
  });
});

describe("deleteSigner and unlockDesign", () => {
  it("delete and unlock for the guarded event", async () => {
    mocks.removeSigner.mockResolvedValue(true);
    mocks.unlockCertificate.mockResolvedValue({ ok: true });
    expect(await actions.deleteSigner("e1", "s1")).toEqual({});
    expect(mocks.removeSigner).toHaveBeenCalledWith({ eventId: "e1", signerId: "s1" });
    expect(await actions.unlockDesign("e1")).toEqual({});
    expect(mocks.unlockCertificate).toHaveBeenCalledWith({ eventId: "e1", actorId: "u1" });
  });

  it("refuse disabled events and report denials", async () => {
    mocks.requireEventOwner.mockResolvedValueOnce(disabled).mockResolvedValueOnce(disabled);
    expect((await actions.deleteSigner("e1", "s1")).error).toBe("Acara ini dinonaktifkan admin.");
    expect((await actions.unlockDesign("e1")).error).toBe("Acara ini dinonaktifkan admin.");
    mocks.removeSigner.mockResolvedValue(false);
    mocks.unlockCertificate.mockResolvedValueOnce({ ok: false, reason: "ISSUED" }).mockResolvedValueOnce({ ok: false, reason: "NOT_LOCKED" });
    expect((await actions.deleteSigner("e1", "s1")).error).toMatch(/terkunci/);
    expect((await actions.unlockDesign("e1")).error).toMatch(/sudah terbit/);
    expect((await actions.unlockDesign("e1")).error).toMatch(/tidak dalam keadaan terkunci/);
  });

  it("return a friendly error and record unexpected failures", async () => {
    const failure = new Error("db down");
    mocks.removeSigner.mockRejectedValue(failure);
    mocks.unlockCertificate.mockRejectedValue(failure);
    expect(await actions.deleteSigner("e1", "s1")).toEqual({ error: ACTION_ERROR_MESSAGE });
    expect(await actions.unlockDesign("e1")).toEqual({ error: ACTION_ERROR_MESSAGE });
    expect(mocks.recordError).toHaveBeenCalledWith({ source: "action.deleteSigner", error: failure });
    expect(mocks.recordError).toHaveBeenCalledWith({ source: "action.unlockDesign", error: failure });
  });
});

describe("issueEventCertificates", () => {
  it("issues and schedules emails when something was issued", async () => {
    mocks.issueCertificates.mockResolvedValue({ ok: true, issued: 4 });
    expect(await actions.issueEventCertificates("e1")).toEqual({ issued: 4 });
    expect(mocks.issueCertificates).toHaveBeenCalledWith("e1", "u1");
    expect(mocks.scheduleEmailDrain).toHaveBeenCalled();
  });

  it("does not schedule emails when nothing was issued", async () => {
    mocks.issueCertificates.mockResolvedValue({ ok: true, issued: 0 });
    await actions.issueEventCertificates("e1");
    expect(mocks.scheduleEmailDrain).not.toHaveBeenCalled();
  });

  it("maps blockers to messages", async () => {
    mocks.issueCertificates.mockResolvedValueOnce({ ok: false, reason: "NOT_FOUND" });
    mocks.issueCertificates.mockResolvedValueOnce({ ok: false, reason: "NO_SIGNERS" });
    expect(await actions.issueEventCertificates("e1")).toEqual({ error: "Acara tidak ditemukan." });
    expect(await actions.issueEventCertificates("e1")).toEqual({ error: "Tambahkan minimal satu penandatangan." });
  });

  it("returns a friendly error and records an unexpected failure", async () => {
    const failure = new Error("db down");
    mocks.issueCertificates.mockRejectedValue(failure);
    expect(await actions.issueEventCertificates("e1")).toEqual({ error: ACTION_ERROR_MESSAGE });
    expect(mocks.recordError).toHaveBeenCalledWith({ source: "action.issueEventCertificates", error: failure });
  });
});

describe("revokeEventCertificate", () => {
  it("requires a reason", async () => {
    expect(await actions.revokeEventCertificate("e1", "c1", "  ")).toHaveProperty("error");
    expect(mocks.revokeCertificate).not.toHaveBeenCalled();
  });

  it("passes the trimmed reason and owner to the revoke function", async () => {
    mocks.revokeCertificate.mockResolvedValue({ ok: true });
    expect(await actions.revokeEventCertificate("e1", "c1", " Nama salah ketik ")).toEqual({});
    expect(mocks.revokeCertificate).toHaveBeenCalledWith({
      eventId: "e1",
      certificateId: "c1",
      actorId: "u1",
      reason: "Nama salah ketik",
    });
  });

  it.each([
    ["ALREADY_REVOKED", "Sertifikat ini sudah dicabut."],
    ["NOT_FOUND", "Sertifikat tidak ditemukan."],
  ])("reports %s", async (reason, message) => {
    mocks.revokeCertificate.mockResolvedValue({ ok: false, reason });
    expect(await actions.revokeEventCertificate("e1", "c1", "Nama salah ketik")).toEqual({ error: message });
  });

  it("returns a friendly error and records an unexpected failure", async () => {
    const failure = new Error("db down");
    mocks.revokeCertificate.mockRejectedValue(failure);
    expect(await actions.revokeEventCertificate("e1", "c1", "Nama salah ketik")).toEqual({ error: ACTION_ERROR_MESSAGE });
    expect(mocks.recordError).toHaveBeenCalledWith({ source: "action.revokeEventCertificate", error: failure });
  });
});
