import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const storage = vi.hoisted(() => ({
  downloadObject: vi.fn(),
  removeObjects: vi.fn(),
}));

vi.mock("@/server/storage", () => ({
  CERTIFICATE_BACKGROUND_BUCKET: "certificate-backgrounds",
  downloadObject: storage.downloadObject,
  removeObjects: storage.removeObjects,
}));
vi.mock("@/server/db", () => ({ prisma: {} }));
vi.mock("@/lib/env", () => ({ env: {} }));

const { applyCertificateBackground, loadCertificateTemplate } = await import("@/server/certificate-config");
const { BackgroundUnavailableError } = await import("@/server/certificate-background-error");
const { encodeObjectPath } = await vi.importActual<typeof import("@/server/storage")>("@/server/storage");

const EVENT = "evt123";
const PATH = `events/${EVENT}/0123456789abcdef.png`;

async function png(width: number, height: number): Promise<Uint8Array> {
  const { deflateSync } = await import("node:zlib");
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const head = Buffer.alloc(4);
    head.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const tail = Buffer.alloc(4);
    tail.writeUInt32BE(crc(body));
    return Buffer.concat([head, body, tail]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  return new Uint8Array(
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", ihdr),
      chunk("IDAT", deflateSync(raw)),
      chunk("IEND", Buffer.alloc(0)),
    ]),
  );
}

function fakeDb(options: { locked?: boolean; previous?: string | null } = {}) {
  const row = {
    id: "c1",
    eventId: EVENT,
    templateSource: "BUILTIN",
    builtinKey: "classic",
    backgroundPath: options.previous ?? null,
    pageWidth: 841.89,
    pageHeight: 595.28,
    layout: {},
    lockedAt: options.locked ? new Date() : null,
  };
  const db = {
    certificateConfig: {
      findUnique: vi.fn(async () => row),
      updateMany: vi.fn(async () => ({ count: options.locked ? 0 : 1 })),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(db)),
  };
  return db;
}

beforeEach(() => {
  storage.downloadObject.mockReset();
  storage.removeObjects.mockReset();
  storage.removeObjects.mockResolvedValue(undefined);
});

describe("applyCertificateBackground", () => {
  it.each([
    ["a path outside the event prefix", "events/other/0123456789abcdef.png"],
    ["a traversal path", `events/${EVENT}/../other/0123456789abcdef.png`],
    ["an encoded traversal path", `events/${EVENT}/%2e%2e/0123456789abcdef.png`],
    ["an unexpected file name", `events/${EVENT}/evil.png`],
    ["an unexpected extension", `events/${EVENT}/0123456789abcdef.webp`],
  ])("rejects %s without touching storage", async (_label, path) => {
    const db = fakeDb();
    const result = await applyCertificateBackground(EVENT, path, db as never);
    expect(result.ok).toBe(false);
    expect(storage.downloadObject).not.toHaveBeenCalled();
    expect(storage.removeObjects).not.toHaveBeenCalled();
    expect(db.certificateConfig.updateMany).not.toHaveBeenCalled();
  });

  it("accepts a real A4 image and stores the page size", async () => {
    storage.downloadObject.mockResolvedValue(await png(1800, 1273));
    const db = fakeDb();
    const result = await applyCertificateBackground(EVENT, PATH, db as never);
    expect(result).toEqual({ ok: true });
    const call = db.certificateConfig.updateMany.mock.calls[0] as unknown as [{ data: Record<string, unknown> }];
    expect(call[0].data).toMatchObject({ templateSource: "UPLOAD", backgroundPath: PATH, pageHeight: 595.28 });
  });

  it("stores the 16:9 page size", async () => {
    storage.downloadObject.mockResolvedValue(await png(1920, 1080));
    const db = fakeDb();
    expect(await applyCertificateBackground(EVENT, PATH, db as never)).toEqual({ ok: true });
    const call = db.certificateConfig.updateMany.mock.calls[0] as unknown as [{ data: Record<string, unknown> }];
    expect(call[0].data).toMatchObject({ pageHeight: 473.56 });
  });

  it("removes the object when the magic bytes do not match", async () => {
    storage.downloadObject.mockResolvedValue(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]));
    const db = fakeDb();
    const result = await applyCertificateBackground(EVENT, PATH, db as never);
    expect(result.ok).toBe(false);
    expect(storage.removeObjects).toHaveBeenCalledWith("certificate-backgrounds", [PATH]);
    expect(db.certificateConfig.updateMany).not.toHaveBeenCalled();
  });

  it("removes the object when the image is corrupt", async () => {
    const valid = await png(1800, 1273);
    storage.downloadObject.mockResolvedValue(valid.slice(0, 40));
    const result = await applyCertificateBackground(EVENT, PATH, fakeDb() as never);
    expect(result.ok).toBe(false);
    expect(storage.removeObjects).toHaveBeenCalledWith("certificate-backgrounds", [PATH]);
  });

  it("uses the real dimensions rather than anything the client claims", async () => {
    storage.downloadObject.mockResolvedValue(await png(1000, 1000));
    const db = fakeDb();
    const result = await applyCertificateBackground(EVENT, PATH, db as never);
    expect(result).toMatchObject({ ok: false, reason: "INVALID" });
    expect(storage.removeObjects).toHaveBeenCalledWith("certificate-backgrounds", [PATH]);
    expect(db.certificateConfig.updateMany).not.toHaveBeenCalled();
  });

  it("rejects an image below the minimum resolution", async () => {
    storage.downloadObject.mockResolvedValue(await png(1200, 849));
    const result = await applyCertificateBackground(EVENT, PATH, fakeDb() as never);
    expect(result).toMatchObject({ ok: false, reason: "INVALID" });
  });

  it("rejects oversized objects", async () => {
    storage.downloadObject.mockResolvedValue(new Uint8Array(3 * 1024 * 1024 + 1));
    const result = await applyCertificateBackground(EVENT, PATH, fakeDb() as never);
    expect(result).toMatchObject({ ok: false, reason: "INVALID" });
    expect(storage.removeObjects).toHaveBeenCalled();
  });

  it("refuses a locked design and deletes the new object", async () => {
    storage.downloadObject.mockResolvedValue(await png(1800, 1273));
    const result = await applyCertificateBackground(EVENT, PATH, fakeDb({ locked: true }) as never);
    expect(result).toMatchObject({ ok: false, reason: "LOCKED" });
    expect(storage.removeObjects).toHaveBeenCalledWith("certificate-backgrounds", [PATH]);
  });

  it("removes the previous background after replacing it", async () => {
    const previous = `events/${EVENT}/aaaaaaaaaaaaaaaa.jpg`;
    storage.downloadObject.mockResolvedValue(await png(1800, 1273));
    expect(await applyCertificateBackground(EVENT, PATH, fakeDb({ previous }) as never)).toEqual({ ok: true });
    expect(storage.removeObjects).toHaveBeenCalledWith("certificate-backgrounds", [previous]);
  });
});

describe("loadCertificateTemplate", () => {
  const base = { templateSource: "UPLOAD", pageWidth: 841.89, pageHeight: 595.28 };

  it("returns no background for built-in templates", async () => {
    const template = await loadCertificateTemplate({ ...base, templateSource: "BUILTIN", backgroundPath: null });
    expect(template.background).toBeNull();
    expect(storage.downloadObject).not.toHaveBeenCalled();
  });

  it("refuses stored paths that do not match the expected format", async () => {
    await expect(loadCertificateTemplate({ ...base, backgroundPath: "events/x/%2e%2e/secret.png" })).rejects.toBeInstanceOf(
      BackgroundUnavailableError,
    );
    expect(storage.downloadObject).not.toHaveBeenCalled();
  });

  it("wraps download failures", async () => {
    storage.downloadObject.mockRejectedValue(new Error("boom"));
    await expect(loadCertificateTemplate({ ...base, backgroundPath: PATH })).rejects.toBeInstanceOf(
      BackgroundUnavailableError,
    );
  });

  it("loads the image bytes", async () => {
    storage.downloadObject.mockResolvedValue(new Uint8Array([1, 2, 3]));
    const template = await loadCertificateTemplate({ ...base, backgroundPath: PATH });
    expect(template.background?.path).toBe(PATH);
  });
});

describe("encodeObjectPath", () => {
  it("encodes each segment", () => {
    expect(encodeObjectPath("events/a b/%2e%2e/x.png")).toBe("events/a%20b/%252e%252e/x.png");
  });
});
