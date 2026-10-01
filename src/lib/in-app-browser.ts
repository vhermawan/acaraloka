export type InAppBrowser = "whatsapp" | "instagram" | "facebook" | "line";

const PATTERNS: ReadonlyArray<readonly [InAppBrowser, RegExp]> = [
  ["instagram", /Instagram/i],
  ["facebook", /FBAN|FBAV|FB_IAB|FBIOS/i],
  ["line", /\bLine\//i],
  ["whatsapp", /WhatsApp/i],
];

export function detectInAppBrowser(userAgent: string | null | undefined): InAppBrowser | null {
  if (!userAgent) return null;
  for (const [name, pattern] of PATTERNS) {
    if (pattern.test(userAgent)) return name;
  }
  return null;
}

export function isAndroid(userAgent: string | null | undefined): boolean {
  return !!userAgent && /Android/i.test(userAgent);
}

export function buildChromeIntentUrl(url: string): string {
  const parsed = new URL(url);
  const scheme = parsed.protocol.replace(":", "");
  const target = `${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`;
  return `intent://${target}#Intent;scheme=${scheme};package=com.android.chrome;end`;
}
