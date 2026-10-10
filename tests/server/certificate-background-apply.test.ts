import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const storage = vi.hoisted(() => ({
  downloadObject: vi.fn(),
  removeObjects: vi.fn(),
  listObjects: vi.fn(),
}));
const cleanup = vi.hoisted(() => ({ reportCleanupFailure: vi.fn(), removeObjectsQuietly: vi.fn() }));

vi.mock("@/server/storage", () => ({
  CERTIFICATE_BACKGROUND_BUCKET: "certificate-backgrounds",
  downloadObject: storage.downloadObject,
  removeObjects: storage.removeObjects,
  listObjects: storage.listObjects,
}));
vi.mock("@/server/storage-cleanup", () => cleanup);
vi.mock("@/server/db", () => ({ prisma: {} }));
vi.mock("@/lib/env", () => ({ env: {} }));

const { applyCertificateBackground, clearCertificateBackground, loadCertificateTemplate, pruneCertificateBackgrounds } = await import("@/server/certificate-config");
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
  storage.listObjects.mockReset();
  storage.listObjects.mockResolvedValue([]);
  cleanup.reportCleanupFailure.mockReset();
  cleanup.removeObjectsQuietly.mockReset();
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
    expect(cleanup.removeObjectsQuietly).not.toHaveBeenCalled();
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
    expect(cleanup.removeObjectsQuietly).toHaveBeenCalledWith(expect.any(String), "certificate-backgrounds", [PATH]);
    expect(db.certificateConfig.updateMany).not.toHaveBeenCalled();
  });

  it("removes the object when the image is corrupt", async () => {
    const valid = await png(1800, 1273);
    storage.downloadObject.mockResolvedValue(valid.slice(0, 40));
    const result = await applyCertificateBackground(EVENT, PATH, fakeDb() as never);
    expect(result.ok).toBe(false);
    expect(cleanup.removeObjectsQuietly).toHaveBeenCalledWith(expect.any(String), "certificate-backgrounds", [PATH]);
  });

  it("uses the real dimensions rather than anything the client claims", async () => {
    storage.downloadObject.mockResolvedValue(await png(1000, 1000));
    const db = fakeDb();
    const result = await applyCertificateBackground(EVENT, PATH, db as never);
    expect(result).toMatchObject({ ok: false, reason: "INVALID" });
    expect(cleanup.removeObjectsQuietly).toHaveBeenCalledWith(expect.any(String), "certificate-backgrounds", [PATH]);
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
    expect(cleanup.removeObjectsQuietly).toHaveBeenCalled();
  });

  it("refuses a locked design and deletes the new object", async () => {
    storage.downloadObject.mockResolvedValue(await png(1800, 1273));
    const result = await applyCertificateBackground(EVENT, PATH, fakeDb({ locked: true }) as never);
    expect(result).toMatchObject({ ok: false, reason: "LOCKED" });
    expect(cleanup.removeObjectsQuietly).toHaveBeenCalledWith(expect.any(String), "certificate-backgrounds", [PATH]);
  });

  it("removes every object in the event folder except the active one after replacing", async () => {
    const stale = [`events/${EVENT}/aaaaaaaaaaaaaaaa.jpg`, `events/${EVENT}/bbbbbbbbbbbbbbbb.png`];
    storage.downloadObject.mockResolvedValue(await png(1800, 1273));
    storage.listObjects.mockResolvedValue([...stale, PATH]);
    const db = fakeDb({ previous: PATH });
    expect(await applyCertificateBackground(EVENT, PATH, db as never)).toEqual({ ok: true });
    expect(storage.listObjects).toHaveBeenCalledWith("certificate-backgrounds", `events/${EVENT}`);
    expect(storage.removeObjects).toHaveBeenCalledWith("certificate-backgrounds", stale);
  });

  it("does not fail the change when listing or removing fails, and records it", async () => {
    storage.downloadObject.mockResolvedValue(await png(1800, 1273));
    storage.listObjects.mockRejectedValueOnce(new Error("list down"));
    expect(await applyCertificateBackground(EVENT, PATH, fakeDb() as never)).toEqual({ ok: true });
    expect(cleanup.reportCleanupFailure).toHaveBeenCalledTimes(1);

    storage.listObjects.mockResolvedValue([`events/${EVENT}/aaaaaaaaaaaaaaaa.jpg`]);
    storage.removeObjects.mockRejectedValueOnce(new Error("remove down"));
    expect(await applyCertificateBackground(EVENT, PATH, fakeDb() as never)).toEqual({ ok: true });
    expect(cleanup.reportCleanupFailure).toHaveBeenCalledTimes(2);
    expect(cleanup.reportCleanupFailure).toHaveBeenLastCalledWith(
      "certificate-background.prune",
      expect.any(Error),
      { eventId: EVENT },
    );
  });
});

describe("clearCertificateBackground", () => {
  it("empties the event folder", async () => {
    const files = [`events/${EVENT}/aaaaaaaaaaaaaaaa.jpg`, `events/${EVENT}/bbbbbbbbbbbbbbbb.png`];
    storage.listObjects.mockResolvedValue(files);
    const db = fakeDb({ previous: files[0] });
    db.certificateConfig.findUnique.mockImplementation(async () => ({ backgroundPath: null }) as never);
    expect(await clearCertificateBackground(EVENT, db as never)).toEqual({ ok: true });
    expect(storage.removeObjects).toHaveBeenCalledWith("certificate-backgrounds", files);
  });

  it("does not clean up when the design is locked", async () => {
    expect(await clearCertificateBackground(EVENT, fakeDb({ locked: true }) as never)).toMatchObject({ ok: false });
    expect(storage.listObjects).not.toHaveBeenCalled();
  });
});

describe("pruneCertificateBackgrounds", () => {
  it("removes everything when nothing is kept", async () => {
    const files = [`events/${EVENT}/aaaaaaaaaaaaaaaa.jpg`];
    storage.listObjects.mockResolvedValue(files);
    await pruneCertificateBackgrounds(EVENT, null);
    expect(storage.removeObjects).toHaveBeenCalledWith("certificate-backgrounds", files);
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

describe("removeObjects and listObjects", () => {
  it("throws on a non-ok response and paginates listings", async () => {
    vi.resetModules();
    vi.doMock("@/lib/env", () => ({ env: { SUPABASE_URL: "https://s.test", SUPABASE_SERVICE_ROLE_KEY: "k" } }));
    const real = await vi.importActual<typeof import("@/server/storage")>("@/server/storage");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    fetchMock.mockResolvedValueOnce(new Response("nope", { status: 500 }));
    await expect(real.removeObjects("b", ["x"])).rejects.toThrow("500");

    const page = (count: number, start: number) =>
      new Response(JSON.stringify(Array.from({ length: count }, (_, i) => ({ name: `f${start + i}`, id: "i" }))));
    fetchMock.mockResolvedValueOnce(page(100, 0)).mockResolvedValueOnce(page(3, 100));
    const paths = await real.listObjects("b", "events/e 1/");
    expect(paths).toHaveLength(103);
    expect(paths[0]).toBe("events/e 1/f0");
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toMatchObject({ prefix: "events/e 1", offset: 100, sortBy: { column: "name", order: "asc" } });

    fetchMock.mockResolvedValueOnce(new Response("bad", { status: 400 }));
    await expect(real.listObjects("b", "events/e")).rejects.toThrow("400");
    vi.unstubAllGlobals();
    vi.doUnmock("@/lib/env");
  });
});

describe("encodeObjectPath", () => {
  it("encodes each segment", () => {
    expect(encodeObjectPath("events/a b/%2e%2e/x.png")).toBe("events/a%20b/%252e%252e/x.png");
  });
});
