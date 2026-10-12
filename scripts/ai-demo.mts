import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { config } from "dotenv";
import sharp from "sharp";

if (existsSync(".env.local")) config({ path: ".env.local" });

const { values } = parseArgs({
  options: {
    title: { type: "string", default: "Seminar Kesehatan Kampus" },
    style: { type: "string", default: "formal-campus" },
    color: { type: "string" },
    note: { type: "string", default: "" },
    signers: { type: "string", default: "2" },
    "fail-brief": { type: "boolean", default: false },
    "no-image": { type: "boolean", default: false },
  },
});

const { checkBlocklist } = await import("../src/lib/ai/blocklist");
const { briefInputSchema, toCertificateLayout, withReadableText } = await import("../src/lib/ai/design-brief");
const { LAYOUT_PRESETS } = await import("../src/lib/ai/layout-presets");
const { BACKGROUND_MAX_BYTES, hasBackgroundSignature, validateBackgroundDimensions, validateBackgroundFile } = await import(
  "../src/lib/certificate-background"
);
const { PAGE_HEIGHT, PAGE_WIDTH, defaultCertificateLayout } = await import("../src/lib/certificate-layout");
const { renderCertificatePdf } = await import("../src/server/certificate-pdf");
const { buildBrief } = await import("../src/server/ai/brief");
const { AiProviderError } = await import("../src/server/ai/errors");
const { normalizeCertificate, sampleAverageColor } = await import("../src/server/ai/image-ops");
const { IMAGE_PROMPT_VERSION, imagePrompt } = await import("../src/server/ai/prompts/image");
const { runWithRetry } = await import("../src/server/ai/retry");

const parsed = briefInputSchema.safeParse({
  eventTitle: values.title,
  style: values.style,
  primaryColor: values.color ?? null,
  hasLogo: false,
  organizerNote: values.note,
});
if (!parsed.success) {
  console.error(`Input tidak valid: ${parsed.error.issues.map((issue) => `${issue.path.join(".")} (${issue.code})`).join(", ")}`);
  process.exit(1);
}
const input = parsed.data;

const verdict = checkBlocklist(input.organizerNote);
if (verdict.blocked) {
  console.log(`DITOLAK: keterangan memuat konten terlarang (kategori ${verdict.category}). Tidak ada panggilan ke vendor.`);
  process.exit(2);
}

const signerCount = Math.min(3, Math.max(1, Number(values.signers) || 2));
const outDir = join("tmp", "ai-demo", new Date().toISOString().replace(/[:.]/g, "-"));
await mkdir(outDir, { recursive: true });

const failingText = {
  id: "demo-failing",
  model: "none",
  async generateJson(): Promise<never> {
    throw new AiProviderError("Simulated LLM failure (--fail-brief)", "RETRYABLE", 503);
  },
};

let textProvider = failingText;
let imageProvider: Awaited<ReturnType<typeof loadImageProvider>> | null = null;

async function loadImageProvider() {
  const { getImageProvider } = await import("../src/server/ai/config");
  return getImageProvider();
}

if (!values["fail-brief"]) {
  const { getTextProvider } = await import("../src/server/ai/config");
  textProvider = getTextProvider() as typeof failingText;
}

const started = Date.now();
const briefStart = Date.now();
const briefOutcome = await buildBrief(input, textProvider);
const briefMs = Date.now() - briefStart;
console.log(`Brief: sumber ${briefOutcome.source}${briefOutcome.fallbackReason ? ` (fallback: ${briefOutcome.fallbackReason})` : ""}, ${briefMs} ms`);
await writeFile(join(outDir, "brief.json"), JSON.stringify({ input, ...briefOutcome }, null, 2));

let original: { bytes: Uint8Array; mime: string; costMicros: number };
let imageMs = 0;
let attempts = 0;
if (values["no-image"]) {
  const { palette } = briefOutcome.brief;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2528" height="1696"><rect width="100%" height="100%" fill="${palette.background}"/><rect x="60" y="60" width="2408" height="1576" fill="none" stroke="${palette.primary}" stroke-width="14"/></svg>`;
  original = { bytes: new Uint8Array(await sharp(Buffer.from(svg)).png().toBuffer()), mime: "image/png", costMicros: 0 };
  console.log("Gambar: latar sintetis (--no-image), tanpa panggilan vendor");
} else {
  imageProvider = await loadImageProvider();
  const request = {
    kind: "CERTIFICATE",
    aspect: "A4_LANDSCAPE",
    minWidth: 1754,
    spec: { style: input.style, brief: briefOutcome.brief },
  } as const;
  const imageStart = Date.now();
  const generated = await runWithRetry((signal) => imageProvider!.generate(request, { signal }), {
    deadlineAt: Date.now() + 60_000,
  });
  imageMs = Date.now() - imageStart;
  attempts = generated.attempts;
  original = generated.value;
  await writeFile(join(outDir, "prompt.txt"), `${IMAGE_PROMPT_VERSION}\n\n${imagePrompt(request.spec)}\n`);
  console.log(`Gambar: ${generated.value.width}x${generated.value.height}, ${imageMs} ms, percobaan ${attempts}`);
}
await writeFile(join(outDir, `original.${original.mime.includes("jpeg") ? "jpg" : "png"}`), original.bytes);

const normalized = await normalizeCertificate(original.bytes, BACKGROUND_MAX_BYTES);
await writeFile(join(outDir, "background.jpg"), normalized.bytes);
const validationError =
  validateBackgroundFile(normalized.mime, normalized.bytes.byteLength) ??
  (() => {
    const result = validateBackgroundDimensions(normalized.width, normalized.height);
    return result.ok ? null : result.error;
  })() ??
  (hasBackgroundSignature(normalized.bytes, "jpg") ? null : "Signature JPEG tidak valid");

const preset = LAYOUT_PRESETS[briefOutcome.brief.layoutPreset];
const sample = await sampleAverageColor(normalized.bytes, preset.safeArea);
const { brief, contrast } = withReadableText(briefOutcome.brief, sample);
const layout = toCertificateLayout(brief, defaultCertificateLayout(signerCount), signerCount);

const signers = [
  { name: "Dr. Ahmad Fauzi", title: "Ketua Panitia", signaturePng: null },
  { name: "Siti Rahma, M.Pd.", title: "Dekan", signaturePng: null },
  { name: "Budi Santoso, S.T.", title: "Sekretaris", signaturePng: null },
].slice(0, signerCount);

const pdf = await renderCertificatePdf(
  layout,
  {
    recipientName: "Rina Pratama",
    certificateNumber: "CERT/2026/0001",
    eventTitle: input.eventTitle,
    eventDate: "12 Oktober 2026",
    organizerName: "Panitia Acaraloka",
    verifyUrl: "https://acaraloka.example/verify/contoh",
    signers,
  },
  {
    watermark: "PRATINJAU",
    template: {
      pageWidth: PAGE_WIDTH,
      pageHeight: PAGE_HEIGHT,
      background: { bytes: normalized.bytes, path: `events/demo/${"0".repeat(16)}.jpg` },
    },
  },
);
await writeFile(join(outDir, "preview.pdf"), pdf);
await writeFile(join(outDir, "layout.json"), JSON.stringify(layout, null, 2));

const costMicros = briefOutcome.costMicros + original.costMicros;
const summary = {
  briefSource: briefOutcome.source,
  fallbackReason: briefOutcome.fallbackReason,
  briefMs,
  imageMs,
  totalMs: Date.now() - started,
  imageAttempts: attempts,
  source: normalized.source,
  output: { width: normalized.width, height: normalized.height, bytes: normalized.bytes.byteLength },
  validationError,
  sampledBackground: sample,
  requestedTextColor: briefOutcome.brief.palette.text,
  finalTextColor: brief.palette.text,
  contrastAdjusted: contrast.adjusted,
  contrastRatio: Number(contrast.ratio.toFixed(2)),
  costUsd: Number((costMicros / 1_000_000).toFixed(4)),
};
await writeFile(join(outDir, "summary.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
console.log(`Output: ${outDir}`);
