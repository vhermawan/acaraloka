import { randomBytes } from "node:crypto";

export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export function createEventSlug(title: string): string {
  const suffix = randomBytes(4).toString("hex").slice(0, 6);
  const base = slugify(title);
  return base ? `${base}-${suffix}` : `acara-${suffix}`;
}
