import { beforeEach, describe, expect, it, vi } from "vitest";

import { TERMS_VERSION } from "@/lib/legal";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  findOrganizer: vi.fn(),
  findEvent: vi.fn(),
  sideEffect: vi.fn(),
}));

function recorded() {
  return vi.fn(async () => {
    mocks.sideEffect();
    return undefined;
  });
}

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/server/db", () => ({
  prisma: new Proxy(
    {
      organizerProfile: { findUnique: mocks.findOrganizer },
      event: { findUnique: mocks.findEvent },
    },
    {
      get(target, property) {
        if (property in target) return target[property as keyof typeof target];
        mocks.sideEffect();
        throw new Error(`UNEXPECTED_DB_ACCESS:${String(property)}`);
      },
    },
  ),
}));
vi.mock("@/server/storage", () => ({
  POSTER_BUCKET: "posters",
  createSignedUploadUrl: recorded(),
  removeObjects: recorded(),
}));
vi.mock("@/server/email-schedule", () => ({ scheduleEmailDrain: recorded() }));
vi.mock("@/server/cancellation", () => ({ cancelEvent: recorded(), cancelRegistration: recorded() }));
vi.mock("@/server/checkin", () => ({
  checkIn: recorded(),
  undoCheckIn: recorded(),
  searchCheckInParticipants: recorded(),
}));
vi.mock("@/server/certificate-config", () => ({ saveCertificateLayout: recorded() }));
vi.mock("@/server/certificates", () => ({
  issueCertificates: recorded(),
  revokeCertificate: recorded(),
  updateRegistrationName: recorded(),
}));
vi.mock("@/server/signers", () => ({
  addSigner: recorded(),
  regenerateSignerLink: recorded(),
  removeSigner: recorded(),
  unlockCertificate: recorded(),
}));
vi.mock("@/server/admin-events", () => ({ disableEvent: recorded(), enableEvent: recorded() }));
vi.mock("@/server/registration", () => ({ createRegistration: recorded() }));
vi.mock("@/server/public-event", () => ({ getPublicEvent: recorded() }));
vi.mock("@/server/registration-form", () => ({ getRegistrationFields: recorded() }));

const eventActions = await import("@/app/organizer/events/actions");
const ticketActions = await import("@/app/organizer/events/[id]/tickets/actions");
const formActions = await import("@/app/organizer/events/[id]/form/actions");
const participantActions = await import("@/app/organizer/events/[id]/participants/actions");
const checkinActions = await import("@/app/organizer/events/[id]/checkin/actions");
const certificateActions = await import("@/app/organizer/events/[id]/certificate/actions");
const adminActions = await import("@/app/admin/events/actions");
const myTicketActions = await import("@/app/me/tickets/[id]/actions");
const registerActions = await import("@/app/e/[slug]/register/actions");
const organizerRegisterActions = await import("@/app/organizer/register/actions");
const legalActions = await import("@/app/legal/accept/actions");

type Call = [string, () => Promise<unknown>];

const form = () => new FormData();

const ownerActions: Call[] = [
  ["updateEvent", () => eventActions.updateEvent("e1", {}, form())],
  ["deleteEvent", () => eventActions.deleteEvent("e1")],
  ["createPosterUpload", () => eventActions.createPosterUpload("e1", { contentType: "image/png", size: 10 })],
  ["setEventPoster", () => eventActions.setEventPoster("e1", "events/e1/x.png")],
  ["publishEvent", () => eventActions.publishEvent("e1")],
  ["cancelEventAction", () => eventActions.cancelEventAction("e1", {}, form())],
  ["createTicketType", () => ticketActions.createTicketType("e1", {}, form())],
  ["updateTicketType", () => ticketActions.updateTicketType("e1", "t1", {}, form())],
  ["deleteTicketType", () => ticketActions.deleteTicketType("e1", "t1")],
  ["createFormField", () => formActions.createFormField("e1", {}, form())],
  ["updateFormField", () => formActions.updateFormField("e1", "f1", {}, form())],
  ["deleteFormField", () => formActions.deleteFormField("e1", "f1")],
  ["moveFormField", () => formActions.moveFormField("e1", "f1", "up")],
  ["cancelParticipant", () => participantActions.cancelParticipant("e1", "r1", "")],
  ["checkInByCode", () => checkinActions.checkInByCode("e1", "abcdefghijklmnopqrstuvwxyz")],
  ["checkInByRegistration", () => checkinActions.checkInByRegistration("e1", "r1")],
  ["undoParticipantCheckIn", () => checkinActions.undoParticipantCheckIn("e1", "r1")],
  ["searchParticipants", () => checkinActions.searchParticipants("e1", "budi")],
  ["saveLayout", () => certificateActions.saveLayout("e1", {})],
  ["createSigner", () => certificateActions.createSigner("e1", {}, form())],
  ["regenerateLink", () => certificateActions.regenerateLink("e1", "s1")],
  ["emailSignerLink", () => certificateActions.emailSignerLink("e1", "s1")],
  ["deleteSigner", () => certificateActions.deleteSigner("e1", "s1")],
  ["unlockDesign", () => certificateActions.unlockDesign("e1")],
  ["issueEventCertificates", () => certificateActions.issueEventCertificates("e1")],
  ["revokeEventCertificate", () => certificateActions.revokeEventCertificate("e1", "c1", "Nama salah ketik")],
];

const organizerActions: Call[] = [["createEvent", () => eventActions.createEvent({}, form())], ...ownerActions];

const adminOnlyActions: Call[] = [
  ["disableEventAction", () => adminActions.disableEventAction("e1", {}, form())],
  ["enableEventAction", () => adminActions.enableEventAction("e1")],
];

const participantOnlyActions: Call[] = [
  ["cancelMyRegistration", () => myTicketActions.cancelMyRegistration("r1")],
  ["renameMyRegistration", () => myTicketActions.renameMyRegistration("r1", "Nama Baru")],
];

const signedInActions: Call[] = [
  ["registerForEvent", () => registerActions.registerForEvent("slug", {}, form())],
  ["registerOrganizer", () => organizerRegisterActions.registerOrganizer({}, form())],
  ["acceptTerms", () => legalActions.acceptTerms(form())],
];

function session(overrides: Record<string, unknown> = {}) {
  return {
    session: { id: "s1" },
    user: {
      id: "u1",
      emailVerified: true,
      role: "ORGANIZER",
      disabledAt: null,
      termsVersion: TERMS_VERSION,
      termsAcceptedAt: new Date(),
      ...overrides,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findOrganizer.mockResolvedValue({ userId: "u1", orgName: "HIMA" });
});

describe("without a session", () => {
  beforeEach(() => {
    mocks.getSession.mockResolvedValue(null);
  });

  it.each([...organizerActions, ...adminOnlyActions, ...participantOnlyActions, ...signedInActions])(
    "%s redirects to login and changes nothing",
    async (_name, call) => {
      await expect(call()).rejects.toThrow(/^REDIRECT:\/(organizer\/|admin\/)?login/);
      expect(mocks.sideEffect).not.toHaveBeenCalled();
    },
  );
});

describe("with a disabled account", () => {
  beforeEach(() => {
    mocks.getSession.mockResolvedValue(session({ disabledAt: new Date() }));
  });

  it.each([...organizerActions, ...participantOnlyActions, ...signedInActions.slice(0, 2)])(
    "%s is refused and changes nothing",
    async (_name, call) => {
      await expect(call()).rejects.toThrow(/error=disabled/);
      expect(mocks.sideEffect).not.toHaveBeenCalled();
    },
  );

  it.each(adminOnlyActions)("%s is refused for a disabled admin and changes nothing", async (_name, call) => {
    mocks.getSession.mockResolvedValue(session({ role: "ADMIN", disabledAt: new Date() }));
    await expect(call()).rejects.toThrow("REDIRECT:/admin/login?error=disabled");
    expect(mocks.sideEffect).not.toHaveBeenCalled();
  });
});

describe("with the wrong role", () => {
  it.each(organizerActions)("%s refuses a participant account", async (_name, call) => {
    mocks.getSession.mockResolvedValue(session({ role: "PARTICIPANT" }));
    await expect(call()).rejects.toThrow("REDIRECT:/organizer/login?error=role-participant");
    expect(mocks.sideEffect).not.toHaveBeenCalled();
  });

  it.each(participantOnlyActions)("%s refuses an organizer account", async (_name, call) => {
    mocks.getSession.mockResolvedValue(session({ role: "ORGANIZER" }));
    await expect(call()).rejects.toThrow("REDIRECT:/organizer");
    expect(mocks.sideEffect).not.toHaveBeenCalled();
  });

  it.each(adminOnlyActions)("%s hides itself from participants and organizers", async (_name, call) => {
    for (const role of ["PARTICIPANT", "ORGANIZER"]) {
      mocks.getSession.mockResolvedValue(session({ role }));
      await expect(call()).rejects.toThrow("NOT_FOUND");
    }
    expect(mocks.sideEffect).not.toHaveBeenCalled();
  });

  it.each(organizerActions)("%s refuses an admin account", async (_name, call) => {
    mocks.getSession.mockResolvedValue(session({ role: "ADMIN" }));
    await expect(call()).rejects.toThrow("REDIRECT:/organizer/login?error=role-admin");
    expect(mocks.sideEffect).not.toHaveBeenCalled();
  });

  it.each(participantOnlyActions)("%s refuses an admin account", async (_name, call) => {
    mocks.getSession.mockResolvedValue(session({ role: "ADMIN" }));
    await expect(call()).rejects.toThrow("REDIRECT:/admin");
    expect(mocks.sideEffect).not.toHaveBeenCalled();
  });

  it.each(organizerActions)("%s redirects an organizer without profile to registration", async (_name, call) => {
    mocks.getSession.mockResolvedValue(session());
    mocks.findOrganizer.mockResolvedValue(null);
    await expect(call()).rejects.toThrow("REDIRECT:/organizer/register");
    expect(mocks.sideEffect).not.toHaveBeenCalled();
  });

  it("registerOrganizer refuses participant accounts", async () => {
    mocks.getSession.mockResolvedValue(session({ role: "PARTICIPANT" }));
    const state = await organizerRegisterActions.registerOrganizer({}, form());
    expect(state.message).toBeTruthy();
    expect(mocks.sideEffect).not.toHaveBeenCalled();
  });

  it("registerForEvent refuses unverified emails before reading the event", async () => {
    mocks.getSession.mockResolvedValue(session({ role: "PARTICIPANT", emailVerified: false }));
    const state = await registerActions.registerForEvent("slug", {}, form());
    expect(state.message).toMatch(/Verifikasi email/);
    expect(mocks.sideEffect).not.toHaveBeenCalled();
  });
});

describe("as an organizer who does not own the event", () => {
  it.each(ownerActions)("%s is refused with not found", async (_name, call) => {
    mocks.getSession.mockResolvedValue(session());
    mocks.findEvent.mockResolvedValue({ id: "e1", organizerId: "someone-else", status: "PUBLISHED" });
    await expect(call()).rejects.toThrow("NOT_FOUND");
    expect(mocks.sideEffect).not.toHaveBeenCalled();
  });

  it.each(ownerActions)("%s is refused for an unknown event id", async (_name, call) => {
    mocks.getSession.mockResolvedValue(session());
    mocks.findEvent.mockResolvedValue(null);
    await expect(call()).rejects.toThrow("NOT_FOUND");
    expect(mocks.sideEffect).not.toHaveBeenCalled();
  });
});

describe("closed events", () => {
  const closedGuarded: Call[] = [
    ["cancelParticipant", () => participantActions.cancelParticipant("e1", "r1", "")],
    ["saveLayout", () => certificateActions.saveLayout("e1", {})],
    ["deleteSigner", () => certificateActions.deleteSigner("e1", "s1")],
    ["unlockDesign", () => certificateActions.unlockDesign("e1")],
    ["regenerateLink", () => certificateActions.regenerateLink("e1", "s1")],
    ["createSigner", () => certificateActions.createSigner("e1", {}, form())],
    ["createTicketType", () => ticketActions.createTicketType("e1", {}, form())],
    ["deleteTicketType", () => ticketActions.deleteTicketType("e1", "t1")],
    ["createFormField", () => formActions.createFormField("e1", {}, form())],
    ["deleteFormField", () => formActions.deleteFormField("e1", "f1")],
    ["updateEvent", () => eventActions.updateEvent("e1", {}, form())],
    ["setEventPoster", () => eventActions.setEventPoster("e1", "events/e1/x.png")],
  ];

  it.each(closedGuarded)("%s makes no change on a disabled event", async (_name, call) => {
    mocks.getSession.mockResolvedValue(session());
    mocks.findEvent.mockResolvedValue({ id: "e1", organizerId: "u1", status: "DISABLED", slug: "x", title: "T" });
    await call();
    expect(mocks.sideEffect).not.toHaveBeenCalled();
  });
});
