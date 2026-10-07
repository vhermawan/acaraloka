import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { defaultCertificateLayout } from "@/lib/certificate-layout";
import { saveCertificateLayout } from "@/server/certificate-config";
import {
  addSigner,
  declineWithToken,
  findSignerByToken,
  regenerateSignerLink,
  removeSigner,
  signWithToken,
  unlockCertificate,
  type SignatureStore,
} from "@/server/signers";

const runId = `itsg-${Date.now()}`;
const clients = Array.from({ length: 3 }, () =>
  new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL!, max: 1 }) }),
);
const db = clients[0];
const organizerId = `${runId}-org`;
let eventId = "";
const png = new Uint8Array(100).fill(1);

function memoryStore() {
  const files = new Set<string>();
  const store: SignatureStore = {
    upload: async (path) => {
      files.add(path);
    },
    remove: async (paths) => {
      for (const path of paths) files.delete(path);
    },
  };
  return { files, store };
}

function signer(index: number) {
  return { eventId, name: `Penandatangan ${index}`, title: "Ketua", email: `s${index}@test.test` };
}

beforeAll(async () => {
  await db.user.create({ data: { id: organizerId, name: organizerId, email: `${organizerId}@test.test`, emailVerified: true } });
  await db.organizerProfile.create({ data: { userId: organizerId, orgName: "IT", contactPhone: "081234567890" } });
  const event = await db.event.create({
    data: {
      organizerId,
      slug: runId,
      title: "Signer test",
      description: "Signer test",
      startAt: new Date(Date.now() + 86_400_000),
      endAt: new Date(Date.now() + 90_000_000),
      venue: "Test",
      status: "PUBLISHED",
    },
  });
  eventId = event.id;
});

afterAll(async () => {
  await db.auditLog.deleteMany({ where: { actorId: organizerId } });
  await db.event.deleteMany({ where: { id: eventId } });
  await db.user.deleteMany({ where: { id: { startsWith: runId } } });
  await Promise.all(clients.map((client) => client.$disconnect()));
});

describe("signers against Postgres", () => {
  const tokens: string[] = [];

  it("allows at most three signers, even when added in parallel", async () => {
    await saveCertificateLayout(eventId, defaultCertificateLayout(1), db);
    const results = await Promise.all([1, 2, 3, 4].map((index) => addSigner(signer(index), clients[index % 3])));
    expect(results.filter((result) => result.ok)).toHaveLength(3);
    expect(results.filter((result) => !result.ok && result.reason === "FULL")).toHaveLength(1);
    for (const result of results) if (result.ok) tokens.push(result.token);

    const orders = (await db.signer.findMany({ where: { eventId }, orderBy: { order: "asc" } })).map((row) => row.order);
    expect(orders).toEqual([1, 2, 3]);
    const config = await db.certificateConfig.findUniqueOrThrow({ where: { eventId } });
    expect((config.layout as { signers: { x: number }[] }).signers.map((block) => block.x)).toEqual([0.25, 0.5, 0.75]);
  });

  it("stores only the token hash", async () => {
    const rows = await db.signer.findMany({ where: { eventId } });
    for (const token of tokens) expect(rows.some((row) => row.tokenHash === token)).toBe(false);
    expect((await findSignerByToken(tokens[0], db))?.eventId).toBe(eventId);
    expect(await findSignerByToken("tidak-ada", db)).toBeNull();
  });

  it("removes a pending signer and renumbers the rest", async () => {
    const target = await findSignerByToken(tokens[2], db);
    expect(await removeSigner({ eventId, signerId: target!.id }, db)).toBe(true);
    const orders = (await db.signer.findMany({ where: { eventId }, orderBy: { order: "asc" } })).map((row) => row.order);
    expect(orders).toEqual([1, 2]);
    const config = await db.certificateConfig.findUniqueOrThrow({ where: { eventId } });
    expect((config.layout as { signers: { x: number }[] }).signers.slice(0, 2).map((block) => block.x)).toEqual([0.333, 0.667]);
    tokens.pop();
  });

  it("signs once, locks the design, and rejects a second use of the link", async () => {
    const { files, store } = memoryStore();
    const results = await Promise.all(
      clients.map((client) =>
        signWithToken({ token: tokens[0], signaturePng: png, ip: "203.0.113.5", userAgent: "test" }, client, store),
      ),
    );
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(files.size).toBe(1);

    const signed = await findSignerByToken(tokens[0], db);
    expect(signed?.status).toBe("SIGNED");
    expect(signed?.consentIp).toBe("203.0.113.5");
    expect([...files][0]).toBe(signed?.signaturePath);

    const config = await db.certificateConfig.findUniqueOrThrow({ where: { eventId } });
    expect(config.lockedAt).not.toBeNull();
    expect(await saveCertificateLayout(eventId, defaultCertificateLayout(2), db)).toBe(false);
    expect(await addSigner(signer(9), db)).toEqual({ ok: false, reason: "LOCKED" });
    expect(await regenerateSignerLink({ eventId, signerId: signed!.id, actorId: organizerId }, db)).toBeNull();
  });

  it("records a decline and lets the organizer issue a fresh link", async () => {
    expect(await declineWithToken({ token: tokens[1], reason: "Jabatan salah" }, db)).toBe(true);
    expect(await declineWithToken({ token: tokens[1], reason: "Lagi" }, db)).toBe(false);
    const declined = await findSignerByToken(tokens[1], db);
    expect(declined?.status).toBe("DECLINED");

    const fresh = await regenerateSignerLink({ eventId, signerId: declined!.id, actorId: organizerId }, db);
    expect(fresh).not.toBeNull();
    expect(await findSignerByToken(tokens[1], db)).toBeNull();
    const renewed = await findSignerByToken(fresh!, db);
    expect(renewed?.status).toBe("PENDING");
    expect(renewed?.declineReason).toBeNull();
    tokens[1] = fresh!;
  });

  it("rejects expired links", async () => {
    const later = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
    const { store } = memoryStore();
    await expect(
      signWithToken({ token: tokens[1], signaturePng: png, ip: null, userAgent: null }, db, store, later),
    ).resolves.toEqual({ ok: false, reason: "INVALID_LINK" });
  });

  it("unlocks by resetting every signature, and refuses once certificates are issued", async () => {
    const { files, store } = memoryStore();
    const signedPath = (await findSignerByToken(tokens[0], db))!.signaturePath!;
    files.add(signedPath);

    expect(await unlockCertificate({ eventId, actorId: organizerId }, db, store)).toEqual({ ok: true });
    expect(files.size).toBe(0);
    const rows = await db.signer.findMany({ where: { eventId } });
    expect(rows.every((row) => row.status === "PENDING" && row.signaturePath === null)).toBe(true);
    expect(await findSignerByToken(tokens[0], db)).toBeNull();
    expect((await db.certificateConfig.findUniqueOrThrow({ where: { eventId } })).lockedAt).toBeNull();
    expect(await unlockCertificate({ eventId, actorId: organizerId }, db, store)).toEqual({ ok: false, reason: "NOT_LOCKED" });

    await db.certificateConfig.update({ where: { eventId }, data: { lockedAt: new Date(), firstIssuedAt: new Date() } });
    expect(await unlockCertificate({ eventId, actorId: organizerId }, db, store)).toEqual({ ok: false, reason: "ISSUED" });
  });
});
