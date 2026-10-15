import "server-only";

import sanitizeHtml from "sanitize-html";

import { descriptionToHtml } from "@/lib/rich-text";
import { EVENT_IMAGE_BUCKET, publicObjectUrl } from "@/server/storage";

const LINK_SCHEME = /^(?:https?:|mailto:)/i;
const IMAGE_TAIL = /^[A-Za-z0-9_\-./%]+$/;
const ALIGNABLE = ["p", "h2", "h3", "blockquote", "li"];

export function eventImagePrefix(): string | null {
  try {
    return publicObjectUrl(EVENT_IMAGE_BUCKET, "");
  } catch {
    return null;
  }
}

function isAllowedImage(src: string, prefix: string | null): boolean {
  if (!prefix || !src.startsWith(prefix)) return false;
  const tail = src.slice(prefix.length);
  return IMAGE_TAIL.test(tail) && !tail.includes("..");
}

export function sanitizeDescription(raw: string, imagePrefix: string | null = eventImagePrefix()): string {
  return sanitizeHtml(descriptionToHtml(raw), {
    allowedTags: ["p", "br", "strong", "em", "u", "s", "h2", "h3", "ul", "ol", "li", "blockquote", "a", "img"],
    allowedAttributes: {
      a: ["href", "rel", "target"],
      img: ["src", "alt"],
      ...Object.fromEntries(ALIGNABLE.map((tag) => [tag, ["style"]])),
    },
    allowedStyles: { "*": { "text-align": [/^(?:left|center|right)$/] } },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["https", "http"] },
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    transformTags: {
      a: (tagName, attribs) => {
        const href = (attribs.href ?? "").trim();
        const safe: Record<string, string> = LINK_SCHEME.test(href)
          ? { href, rel: "noopener noreferrer nofollow", target: "_blank" }
          : {};
        return { tagName, attribs: safe };
      },
      img: (tagName, attribs) => {
        const src = (attribs.src ?? "").trim();
        const safe: Record<string, string> = isAllowedImage(src, imagePrefix) ? { src, alt: attribs.alt ?? "" } : {};
        return { tagName, attribs: safe };
      },
    },
    exclusiveFilter: (frame) => frame.tag === "img" && !frame.attribs.src,
  });
}
