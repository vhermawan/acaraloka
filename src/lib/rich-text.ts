export const DESCRIPTION_MIN_TEXT = 10;
export const DESCRIPTION_MAX_TEXT = 5000;
export const DESCRIPTION_MAX_HTML = 30000;
export const DESCRIPTION_MAX_IMAGES = 10;

const HTML_START = /^<(?:p|h2|h3|ul|ol|blockquote|img)[\s>/]/i;
const BLOCK_BREAK = /<\/(?:p|h2|h3|li|blockquote)>|<br\s*\/?>/gi;
const TAG = /<[^>]*>/g;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function decodeEntities(text: string): string {
  return text.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (match, dec, hex, name) => {
    if (name) return NAMED_ENTITIES[name.toLowerCase()] ?? match;
    const code = dec ? Number.parseInt(dec, 10) : Number.parseInt(hex, 16);
    return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
  });
}

export function isHtmlDescription(value: string): boolean {
  return HTML_START.test(value.trimStart());
}

export function plainTextToHtml(text: string): string {
  const paragraphs = text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  return paragraphs.map((block) => `<p>${block.split("\n").map(escapeHtml).join("<br>")}</p>`).join("");
}

export function descriptionToHtml(value: string): string {
  return isHtmlDescription(value) ? value : plainTextToHtml(value);
}

export function descriptionToText(value: string): string {
  const raw = isHtmlDescription(value) ? decodeEntities(value.replace(BLOCK_BREAK, " ").replace(TAG, "")) : value;
  return raw.replace(/\s+/g, " ").trim();
}

export function countDescriptionImages(value: string): number {
  return isHtmlDescription(value) ? (value.match(/<img[\s/>]/gi) ?? []).length : 0;
}

export function descriptionExcerpt(value: string, length = 160): string {
  const flat = descriptionToText(value);
  return flat.length > length ? `${flat.slice(0, length - 1)}…` : flat;
}
