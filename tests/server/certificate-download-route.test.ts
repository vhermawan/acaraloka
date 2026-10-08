import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getUserCertificateRenderData: vi.fn(),
  renderCertificatePdf: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/server/certificates", () => ({ getUserCertificateRenderData: mocks.getUserCertificateRenderData }));
vi.mock("@/server/certificate-pdf", () => ({ renderCertificatePdf: mocks.renderCertificatePdf }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

const { GET } = await import("@/app/me/certificates/[number]/pdf/route");

const context = (number: string) => ({ params: Promise.resolve({ number }) }) as never;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /me/certificates/[number]/pdf", () => {
  it("returns 404 when not logged in", async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(GET(new Request("http://x"), context("HA-1"))).rejects.toThrow("NOT_FOUND");
    expect(mocks.getUserCertificateRenderData).not.toHaveBeenCalled();
  });

  it("returns 404 when the certificate is not owned by the user", async () => {
    mocks.getSession.mockResolvedValue({ user: { id: "u2", disabledAt: null } });
    mocks.getUserCertificateRenderData.mockResolvedValue(null);
    await expect(GET(new Request("http://x"), context("HA-1"))).rejects.toThrow("NOT_FOUND");
    expect(mocks.getUserCertificateRenderData).toHaveBeenCalledWith("u2", "HA-1");
    expect(mocks.renderCertificatePdf).not.toHaveBeenCalled();
  });

  it("serves an attachment named after the certificate number", async () => {
    mocks.getSession.mockResolvedValue({ user: { id: "u1", disabledAt: null } });
    mocks.getUserCertificateRenderData.mockResolvedValue({ layout: {}, data: { certificateNumber: "HA-2026-0001-ABC123" } });
    mocks.renderCertificatePdf.mockResolvedValue(new Uint8Array([1, 2, 3]));
    const response = await GET(new Request("http://x"), context("HA-2026-0001-ABC123"));
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="sertifikat-HA-2026-0001-ABC123.pdf"');
  });
});
