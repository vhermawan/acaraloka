import { describe, expect, it } from "vitest";

import {
  countDescriptionImages,
  descriptionExcerpt,
  descriptionToHtml,
  descriptionToText,
  isHtmlDescription,
  plainTextToHtml,
} from "@/lib/rich-text";
import { hasImageSignature, isEventImagePathFor, validateEventImageFile } from "@/lib/event-image";

describe("legacy plain text", () => {
  it("wraps paragraphs and escapes markup", () => {
    expect(plainTextToHtml("Halo <b>dunia</b>\nbaris dua\n\nParagraf & lain")).toBe(
      "<p>Halo &lt;b&gt;dunia&lt;/b&gt;<br>baris dua</p><p>Paragraf &amp; lain</p>",
    );
  });

  it("detects html versus plain text", () => {
    expect(isHtmlDescription("<p>Halo</p>")).toBe(true);
    expect(isHtmlDescription('  <h2 style="text-align: center">Judul</h2>')).toBe(true);
    expect(isHtmlDescription("Halo dunia")).toBe(false);
    expect(isHtmlDescription("<script>alert(1)</script>")).toBe(false);
    expect(descriptionToHtml("<script>x</script>")).toBe("<p>&lt;script&gt;x&lt;/script&gt;</p>");
  });
});

describe("descriptionToText", () => {
  it("strips tags, separates blocks and decodes entities", () => {
    expect(descriptionToText("<h2>Judul</h2><p>Isi &amp; <strong>tebal</strong></p><ul><li>satu</li><li>dua</li></ul>")).toBe(
      "Judul Isi & tebal satu dua",
    );
  });

  it("keeps legacy text as-is with collapsed whitespace", () => {
    expect(descriptionToText("Belajar AI\n\n  bersama <praktisi>.")).toBe("Belajar AI bersama <praktisi>.");
  });

  it("does not count images as text", () => {
    expect(descriptionToText('<p>Halo</p><img src="https://x.test/a.png">')).toBe("Halo");
  });
});

describe("descriptionExcerpt", () => {
  it("truncates plain text from html", () => {
    const excerpt = descriptionExcerpt(`<p>${"a".repeat(300)}</p>`);
    expect(excerpt).toHaveLength(160);
    expect(excerpt.endsWith("…")).toBe(true);
  });

  it("returns short text untouched", () => {
    expect(descriptionExcerpt("<p>Singkat</p>")).toBe("Singkat");
  });
});

describe("countDescriptionImages", () => {
  it("counts img tags only in html", () => {
    expect(countDescriptionImages('<p>a</p><img src="x"><img src="y">')).toBe(2);
    expect(countDescriptionImages("<img> teks biasa")).toBe(1);
    expect(countDescriptionImages("teks <img src=x> biasa")).toBe(0);
  });
});

describe("event image helpers", () => {
  it("validates type and size", () => {
    expect(validateEventImageFile("image/gif", 100)).toMatch(/JPG, PNG, atau WebP/);
    expect(validateEventImageFile("image/png", 3 * 1024 * 1024)).toMatch(/2 MB/);
    expect(validateEventImageFile("image/webp", 1000)).toBeNull();
  });

  it("scopes paths to the organizer", () => {
    expect(isEventImagePathFor("user1", "user1/0123456789abcdef.png")).toBe(true);
    expect(isEventImagePathFor("user1", "user2/0123456789abcdef.png")).toBe(false);
    expect(isEventImagePathFor("user1", "user1/../0123456789abcdef.png")).toBe(false);
  });

  it("checks magic bytes", () => {
    const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
    expect(hasImageSignature(webp, "webp")).toBe(true);
    expect(hasImageSignature(webp, "png")).toBe(false);
    expect(hasImageSignature(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), "jpg")).toBe(true);
    expect(hasImageSignature(new Uint8Array([0x3c, 0x73, 0x76, 0x67]), "jpg")).toBe(false);
  });
});
