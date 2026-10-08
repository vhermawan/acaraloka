import { describe, expect, it } from "vitest";
import {
  buildChromeIntentUrl,
  detectInAppBrowser,
  isAndroid,
} from "@/lib/in-app-browser";

const UA = {
  whatsappAndroid:
    "Mozilla/5.0 (Linux; Android 13; SM-A546E Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.144 Mobile Safari/537.36 WhatsApp/2.23.20.0",
  whatsappIos:
    "WhatsApp/2.23.20.76 iOS/17.1 Device/iPhone",
  instagramIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21B74 Instagram 312.0.0.22.114 (iPhone14,5; iOS 17_1; id_ID; id; scale=3.00; 1170x2532; 548333402)",
  instagramAndroid:
    "Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A.230901.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.6045.193 Mobile Safari/537.36 Instagram 311.0.0.32.118 Android (33/13; 420dpi; 1080x2400; Google/google; Pixel 7; panther; panther; en_US; 548333402)",
  facebookAndroid:
    "Mozilla/5.0 (Linux; Android 12; SM-G991B Build/SP1A.210812.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.43 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/443.0.0.30.109;]",
  facebookIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/440.0.0.31.113;FBBV/543210;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS;FBSV/17.1;FBLC/id_ID;FBOP/5]",
  lineAndroid:
    "Mozilla/5.0 (Linux; Android 13; SM-S918B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.144 Mobile Safari/537.36 Line/13.19.0/IAB",
  lineIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/13.19.0",
  chromeDesktop:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  chromeAndroid:
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  safariIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1",
};

describe("detectInAppBrowser", () => {
  it.each([
    ["WhatsApp Android", UA.whatsappAndroid, "whatsapp"],
    ["WhatsApp iOS", UA.whatsappIos, "whatsapp"],
    ["Instagram iOS", UA.instagramIos, "instagram"],
    ["Instagram Android", UA.instagramAndroid, "instagram"],
    ["Facebook Android (FB_IAB/FBAV)", UA.facebookAndroid, "facebook"],
    ["Facebook iOS (FBAN/FBAV)", UA.facebookIos, "facebook"],
    ["LINE Android", UA.lineAndroid, "line"],
    ["LINE iOS", UA.lineIos, "line"],
  ])("mengenali %s", (_label, ua, expected) => {
    expect(detectInAppBrowser(ua)).toBe(expected);
  });

  it.each([
    ["Chrome desktop", UA.chromeDesktop],
    ["Chrome Android", UA.chromeAndroid],
    ["Safari iOS", UA.safariIos],
  ])("mengembalikan null untuk %s", (_label, ua) => {
    expect(detectInAppBrowser(ua)).toBeNull();
  });

  it("mengembalikan null untuk UA kosong", () => {
    expect(detectInAppBrowser("")).toBeNull();
    expect(detectInAppBrowser(null)).toBeNull();
    expect(detectInAppBrowser(undefined)).toBeNull();
  });
});

describe("isAndroid", () => {
  it("membedakan Android dari iOS", () => {
    expect(isAndroid(UA.whatsappAndroid)).toBe(true);
    expect(isAndroid(UA.instagramIos)).toBe(false);
    expect(isAndroid(null)).toBe(false);
  });
});

describe("buildChromeIntentUrl", () => {
  it("membentuk intent Chrome dari URL https", () => {
    expect(buildChromeIntentUrl("https://hadirly.example/login?next=%2Fe%2F1")).toBe(
      "intent://hadirly.example/login?next=%2Fe%2F1#Intent;scheme=https;package=com.android.chrome;end",
    );
  });

  it("mempertahankan port dan skema http", () => {
    expect(buildChromeIntentUrl("http://localhost:3000/login")).toBe(
      "intent://localhost:3000/login#Intent;scheme=http;package=com.android.chrome;end",
    );
  });
});
