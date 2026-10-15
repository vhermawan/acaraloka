import { describe, expect, it } from "vitest";

import { sanitizeDescription } from "@/server/description";

const PREFIX = "https://proj.supabase.co/storage/v1/object/public/event-images/";

function clean(html: string) {
  return sanitizeDescription(html, PREFIX);
}

describe("sanitizeDescription", () => {
  it("keeps allowed formatting", () => {
    const html =
      '<h2 style="text-align: center">Judul</h2><p style="text-align: right"><strong>a</strong><em>b</em><u>c</u><s>d</s><br></p><ul><li><p>x</p></li></ul><ol><li>y</li></ol><blockquote><p>q</p></blockquote>';
    expect(clean(html)).toBe(
      '<h2 style="text-align:center">Judul</h2><p style="text-align:right"><strong>a</strong><em>b</em><u>c</u><s>d</s><br /></p><ul><li><p>x</p></li></ul><ol><li>y</li></ol><blockquote><p>q</p></blockquote>',
    );
  });

  it("removes script tags and content", () => {
    const out = clean("<p>Halo</p><script>alert(1)</script>");
    expect(out).toBe("<p>Halo</p>");
  });

  it("strips event handlers and unknown attributes", () => {
    const out = clean('<p onclick="x()" class="a" id="b">Halo</p><img src="' + PREFIX + 'u/a.png" onerror="alert(1)">');
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("class=");
    expect(out).toContain(`<img src="${PREFIX}u/a.png" alt="" />`);
  });

  it("drops javascript and data links", () => {
    expect(clean('<p><a href="javascript:alert(1)">x</a></p>')).toBe("<p><a>x</a></p>");
    expect(clean('<p><a href=" JaVaScRiPt:alert(1)">x</a></p>')).not.toContain("href");
    expect(clean('<p><a href="data:text/html;base64,AAA">x</a></p>')).not.toContain("href");
    expect(clean('<p><a href="/relatif">x</a></p>')).not.toContain("href");
  });

  it("forces safe rel and target on allowed links", () => {
    expect(clean('<p><a href="https://contoh.com/a?b=1" target="_self" rel="opener">x</a></p>')).toBe(
      '<p><a href="https://contoh.com/a?b=1" rel="noopener noreferrer nofollow" target="_blank">x</a></p>',
    );
    expect(clean('<p><a href="mailto:a@b.co">x</a></p>')).toContain('href="mailto:a@b.co"');
  });

  it("drops images from other origins", () => {
    expect(clean('<img src="https://evil.test/a.png">')).toBe("");
    expect(clean('<img src="javascript:alert(1)">')).toBe("");
    expect(clean('<img src="data:image/png;base64,AAAA">')).toBe("");
    expect(clean(`<img src="${PREFIX}../secret.png">`)).toBe("");
    expect(clean(`<img src="${PREFIX}u/a.png?x=1">`)).toBe("");
    expect(clean('<img src="https://proj.supabase.co.evil.test/storage/v1/object/public/event-images/a.png">')).toBe("");
  });

  it("drops all images when storage is not configured", () => {
    expect(sanitizeDescription(`<img src="${PREFIX}u/a.png">`, null)).toBe("");
  });

  it("keeps images from our bucket", () => {
    expect(clean(`<img src="${PREFIX}user1/0123456789abcdef.webp" alt="Foto">`)).toBe(
      `<img src="${PREFIX}user1/0123456789abcdef.webp" alt="Foto" />`,
    );
  });

  it("allows only text-align styles", () => {
    const out = clean('<p style="color:red; position:fixed; text-align:center; background:url(x)">a</p>');
    expect(out).toBe('<p style="text-align:center">a</p>');
    expect(clean('<p style="text-align:justify">a</p>')).toBe("<p>a</p>");
    expect(clean('<p><span style="text-align:center">a</span></p>')).toBe("<p>a</p>");
  });

  it("discards disallowed tags but keeps their text", () => {
    expect(clean("<p>a</p><iframe src=\"https://x.test\"></iframe><form><input></form><h1>t</h1>")).toBe("<p>a</p>t");
  });

  it("converts legacy plain text and escapes it", () => {
    expect(clean("Halo\n\n<script>alert(1)</script>")).toBe("<p>Halo</p><p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
  });
});
