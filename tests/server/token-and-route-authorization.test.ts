import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireEventOwner: vi.fn(),
  findSignerByToken: vi.fn(),
  signWithToken: vi.fn(),
  declineWithToken: vi.fn(),
  canSign: vi.fn(),
  render: vi.fn(),
  cronSecret: { value: "rahasia-cron" as string | undefined },
  queryRaw: vi.fn(),
  deleteErrors: vi.fn(),
  drain: vi.fn(),
  purge: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "user-agent": "vitest" }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/server/authz", () => ({ requireEventOwner: mocks.requireEventOwner }));
vi.mock("@/server/signers", () => ({
  findSignerByToken: mocks.findSignerByToken,
  signWithToken: mocks.signWithToken,
  declineWithToken: mocks.declineWithToken,
  canSign: mocks.canSign,
  loadSignerRenderData: async () => [],
}));
vi.mock("@/server/certificate-config", () => ({
  getOrCreateCertificateConfig: async () => ({ layout: {} }),
  sampleRenderData: () => ({}),
}));
vi.mock("@/server/certificate-pdf", () => ({ renderCertificatePdf: mocks.render }));
vi.mock("@/server/db", () => ({
  prisma: { $queryRaw: mocks.queryRaw, errorLog: { deleteMany: mocks.deleteErrors } },
}));
vi.mock("@/server/email-outbox", () => ({ drainOutbox: mocks.drain, purgeOldOutbox: mocks.purge }));
vi.mock("@/lib/env", () => ({
  env: {
    get CRON_SECRET() {
      return mocks.cronSecret.value;
    },
    EMAIL_ENABLED: true,
  },
}));

const signActions = await import("@/app/sign/[token]/actions");
const { GET: signPreview } = await import("@/app/sign/[token]/preview/route");
const { GET: organizerPreview } = await import("@/app/organizer/events/[id]/certificate/preview/route");
const { GET: cron } = await import("@/app/api/cron/daily/route");

const PNG_URL = `data:image/png;base64,${Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(80, 1),
]).toString("base64")}`;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cronSecret.value = "rahasia-cron";
});

describe("signer token actions", () => {
  it("rejects a signature without consent before looking up the token", async () => {
    expect(await signActions.submitSignature("token", PNG_URL, false)).toHaveProperty("error");
    expect(mocks.signWithToken).not.toHaveBeenCalled();
  });

  it("rejects an unreadable signature image before looking up the token", async () => {
    expect(await signActions.submitSignature("token", "data:text/plain;base64,AAAA", true)).toHaveProperty("error");
    expect(mocks.signWithToken).not.toHaveBeenCalled();
  });

  it("answers a wrong, expired or used token with the generic link error", async () => {
    mocks.signWithToken.mockResolvedValue({ ok: false, reason: "INVALID_LINK" });
    const result = await signActions.submitSignature("salah", PNG_URL, true);
    expect(result.error).toMatch(/tidak berlaku/);
    expect(mocks.signWithToken).toHaveBeenCalledWith(expect.objectContaining({ token: "salah" }));
    expect(mocks.findSignerByToken).not.toHaveBeenCalled();
  });

  it("answers a wrong token on decline without revalidating anything", async () => {
    mocks.declineWithToken.mockResolvedValue(false);
    const result = await signActions.declineSigning("salah", "Saya tidak berwenang menandatangani");
    expect(result.error).toMatch(/tidak berlaku/);
    expect(mocks.findSignerByToken).not.toHaveBeenCalled();
  });

  it("rejects an empty decline reason before looking up the token", async () => {
    expect(await signActions.declineSigning("token", " ")).toHaveProperty("error");
    expect(mocks.declineWithToken).not.toHaveBeenCalled();
  });
});

describe("GET /sign/[token]/preview", () => {
  const context = (token: string) => ({ params: Promise.resolve({ token }) }) as never;

  it("returns 404 for an unknown token", async () => {
    mocks.findSignerByToken.mockResolvedValue(null);
    await expect(signPreview(new Request("http://x"), context("salah"))).rejects.toThrow("NOT_FOUND");
    expect(mocks.render).not.toHaveBeenCalled();
  });

  it("returns 404 when the link can no longer sign", async () => {
    mocks.findSignerByToken.mockResolvedValue({ eventId: "e1" });
    mocks.canSign.mockReturnValue(false);
    await expect(signPreview(new Request("http://x"), context("kedaluwarsa"))).rejects.toThrow("NOT_FOUND");
    expect(mocks.render).not.toHaveBeenCalled();
  });
});

describe("GET /organizer/events/[id]/certificate/preview", () => {
  it("does not render for someone who does not own the event", async () => {
    mocks.requireEventOwner.mockRejectedValue(new Error("NOT_FOUND"));
    await expect(
      organizerPreview(new Request("http://x"), { params: Promise.resolve({ id: "e1" }) } as never),
    ).rejects.toThrow("NOT_FOUND");
    expect(mocks.render).not.toHaveBeenCalled();
  });
});

describe("GET /api/cron/daily", () => {
  function request(authorization?: string) {
    return new Request("http://x/api/cron/daily", authorization ? { headers: { authorization } } : undefined);
  }

  it.each([undefined, "", "Bearer salah", "rahasia-cron", "Bearer rahasia-cron2"])(
    "returns 401 and does no work for authorization %j",
    async (authorization) => {
      const response = await cron(request(authorization));
      expect(response.status).toBe(401);
      expect(mocks.queryRaw).not.toHaveBeenCalled();
      expect(mocks.deleteErrors).not.toHaveBeenCalled();
      expect(mocks.purge).not.toHaveBeenCalled();
      expect(mocks.drain).not.toHaveBeenCalled();
    },
  );

  it("returns 401 for everyone when CRON_SECRET is not configured", async () => {
    mocks.cronSecret.value = undefined;
    expect((await cron(request("Bearer "))).status).toBe(401);
    expect((await cron(request("Bearer undefined"))).status).toBe(401);
    expect(mocks.deleteErrors).not.toHaveBeenCalled();
  });

  it("runs the job with the right secret", async () => {
    mocks.deleteErrors.mockResolvedValue({ count: 0 });
    mocks.purge.mockResolvedValue(0);
    mocks.drain.mockResolvedValue({ skipped: false });
    const response = await cron(request("Bearer rahasia-cron"));
    expect(response.status).toBe(200);
    expect(mocks.deleteErrors).toHaveBeenCalledOnce();
  });
});
