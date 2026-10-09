import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { normalizeTicketCode } from "@/lib/checkin";

const state = vi.hoisted(() => ({ userId: "", role: "PARTICIPANT" as "PARTICIPANT" | "ORGANIZER" }));
const files = vi.hoisted(() => new Map<string, Uint8Array>());

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "user-agent": "vitest" }) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/server/email-schedule", () => ({ scheduleEmailDrain: vi.fn() }));
vi.mock("@/lib/session", () => ({
  getSession: async () => ({ user: { id: state.userId, role: state.role, disabledAt: null } }),
}));
vi.mock("@/server/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/storage")>()),
  uploadObject: async (_bucket: string, path: string, body: Uint8Array) => {
    files.set(path, body);
  },
  downloadObject: async (_bucket: string, path: string) => {
    const body = files.get(path);
    if (!body) throw new Error("missing");
    return body;
  },
  removeObjects: async (_bucket: string, paths: string[]) => {
    for (const path of paths) files.delete(path);
  },
}));
vi.mock("@/server/authz", async () => {
  const { prisma } = await import("@/server/db");
  return {
    canRegisterFreeTicket: () => true,
    requireUser: async () => ({ id: state.userId, role: state.role, emailVerified: true }),
    requireEventOwner: async (eventId: string) => {
      const event = await prisma.event.findUnique({ where: { id: eventId } });
      if (!event || event.organizerId !== state.userId) throw new Error("NOT_FOUND");
      return { user: { id: state.userId }, organizer: { orgName: "IT" }, event };
    },
  };
});

const { prisma: db } = await import("@/server/db");
const { registerForEvent } = await import("@/app/e/[slug]/register/actions");
const { checkInByCode } = await import("@/app/organizer/events/[id]/checkin/actions");
const { createSigner, issueEventCertificates, revokeEventCertificate } = await import(
  "@/app/organizer/events/[id]/certificate/actions"
);
const { submitSignature } = await import("@/app/sign/[token]/actions");
const { GET: downloadCertificate } = await import("@/app/me/certificates/[number]/pdf/route");
const { default: VerifyCertificatePage } = await import("@/app/v/[number]/page");
const { TicketQr } = await import("@/components/tickets/ticket-qr");
const { getUserTicket } = await import("@/server/tickets");

const runId = `itflow-${Date.now()}`;
const organizerId = `${runId}-org`;
const participantId = `${runId}-p1`;
const strangerId = `${runId}-p2`;
const slug = runId;
const SIGNATURE_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

let eventId = "";
let ticketTypeId = "";
let registrationId = "";
let ticketCode = "";
let signerToken = "";
let certificateNumber = "";

function registrationForm() {
  const data = new FormData();
  data.set("ticketTypeId", ticketTypeId);
  data.set("name", "Peserta Alur Utama");
  data.set("email", `${participantId}@test.test`);
  data.set("phone", "081234567890");
  data.set("consent", "on");
  return data;
}

function signerForm() {
  const data = new FormData();
  data.set("name", "Ketua Panitia");
  data.set("title", "Ketua");
  data.set("email", `${runId}-signer@test.test`);
  return data;
}

function pdfContext(number: string) {
  return { params: Promise.resolve({ number }) } as never;
}

async function redirectTarget(call: () => Promise<unknown>) {
  try {
    await call();
  } catch (error) {
    const match = /^REDIRECT:(.+)$/.exec((error as Error).message);
    if (match) return match[1];
    throw error;
  }
  throw new Error("expected a redirect");
}

beforeAll(async () => {
  await db.user.createMany({
    data: [
      { id: organizerId, name: organizerId, email: `${organizerId}@test.test`, emailVerified: true, role: "ORGANIZER" },
      { id: participantId, name: participantId, email: `${participantId}@test.test`, emailVerified: true },
      { id: strangerId, name: strangerId, email: `${strangerId}@test.test`, emailVerified: true },
    ],
  });
  await db.organizerProfile.create({ data: { userId: organizerId, orgName: "IT", contactPhone: "081234567890" } });
  const event = await db.event.create({
    data: {
      organizerId,
      slug,
      title: "Alur Utama",
      description: "Critical flow test",
      startAt: new Date(Date.now() - 86_400_000),
      endAt: new Date(Date.now() + 86_400_000),
      venue: "Test",
      status: "PUBLISHED",
      ticketTypes: { create: { name: "Umum", quota: 10 } },
    },
    include: { ticketTypes: true },
  });
  eventId = event.id;
  ticketTypeId = event.ticketTypes[0].id;
});

afterAll(async () => {
  await db.auditLog.deleteMany({ where: { actorId: organizerId } });
  await db.event.deleteMany({ where: { id: eventId } });
  await db.user.deleteMany({ where: { id: { startsWith: runId } } });
});

describe("main path: register, e-ticket, check-in, sign, issue, download, verify", () => {
  it("registers a participant and redirects to the e-ticket", async () => {
    state.userId = participantId;
    state.role = "PARTICIPANT";
    const target = await redirectTarget(() => registerForEvent(slug, {}, registrationForm()));
    expect(target).toMatch(/^\/me\/tickets\/.+/);
    registrationId = target.split("/").pop()!;
  });

  it("shows the e-ticket with a QR code only to its owner", async () => {
    const ticket = await getUserTicket(participantId, registrationId);
    expect(ticket?.ticketCode).toBeTruthy();
    ticketCode = ticket!.ticketCode!;
    expect(normalizeTicketCode(ticketCode)).toBe(ticketCode);

    const qr = await TicketQr({ code: ticketCode, label: "QR e-tiket" });
    expect(qr.props.dangerouslySetInnerHTML.__html).toContain("<svg");

    expect(await getUserTicket(strangerId, registrationId)).toBeNull();
  });

  it("lets the event owner check the participant in by the QR code, once", async () => {
    state.userId = organizerId;
    state.role = "ORGANIZER";
    const first = await checkInByCode(eventId, ticketCode);
    expect(first).toMatchObject({ outcome: "VALID", participant: { registrationId, name: "Peserta Alur Utama" } });
    expect((await checkInByCode(eventId, ticketCode)).outcome).toBe("ALREADY_CHECKED_IN");
  });

  it("adds a signer and lets them sign through the token link", async () => {
    const created = await createSigner(eventId, {}, signerForm());
    expect(created.link?.url).toContain("/sign/");
    signerToken = created.link!.url.split("/sign/")[1];

    expect(await submitSignature("token-salah", SIGNATURE_PNG, true)).toHaveProperty("error");
    expect(await submitSignature(signerToken, SIGNATURE_PNG, true)).toEqual({});
    expect(await submitSignature(signerToken, SIGNATURE_PNG, true)).toHaveProperty("error");

    const config = await db.certificateConfig.findUniqueOrThrow({ where: { eventId } });
    expect(config.lockedAt).not.toBeNull();
  });

  it("issues the certificate for the checked-in participant", async () => {
    await expect(issueEventCertificates(eventId)).resolves.toEqual({ issued: 1 });
    const certificate = await db.certificate.findUniqueOrThrow({ where: { registrationId } });
    certificateNumber = certificate.number;
    expect(certificate.revokedAt).toBeNull();
  });

  it("lets only the owner download the certificate PDF", async () => {
    state.userId = participantId;
    state.role = "PARTICIPANT";
    const response = await downloadCertificate(new Request("http://x"), pdfContext(certificateNumber));
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain(`sertifikat-${certificateNumber}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");

    state.userId = strangerId;
    await expect(downloadCertificate(new Request("http://x"), pdfContext(certificateNumber))).rejects.toThrow(
      "NOT_FOUND",
    );

    state.userId = organizerId;
    state.role = "ORGANIZER";
    await expect(downloadCertificate(new Request("http://x"), pdfContext(certificateNumber))).rejects.toThrow(
      "NOT_FOUND",
    );
  });

  it("verifies the certificate publicly on /v/<number>", async () => {
    const page = await VerifyCertificatePage({ params: Promise.resolve({ number: certificateNumber.toLowerCase() }) } as never);
    expect(page).toBeTruthy();
    expect(JSON.stringify(page)).toContain("Terverifikasi");
    expect(JSON.stringify(page)).toContain("Peserta Alur Utama");

    await expect(
      VerifyCertificatePage({ params: Promise.resolve({ number: "TIDAK-ADA-0000" }) } as never),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("shows the revoked status and stops the download after revocation", async () => {
    state.userId = organizerId;
    state.role = "ORGANIZER";
    const certificate = await db.certificate.findUniqueOrThrow({ where: { registrationId } });
    await expect(revokeEventCertificate(eventId, certificate.id, "Nama salah ketik")).resolves.toEqual({});

    const page = await VerifyCertificatePage({ params: Promise.resolve({ number: certificateNumber }) } as never);
    expect(JSON.stringify(page)).toContain("Dicabut");

    state.userId = participantId;
    state.role = "PARTICIPANT";
    await expect(downloadCertificate(new Request("http://x"), pdfContext(certificateNumber))).rejects.toThrow(
      "NOT_FOUND",
    );
  });
});
