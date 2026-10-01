import Script from "next/script";

import { env } from "@/lib/env";

function CloudflareAnalytics() {
  if (!env.CLOUDFLARE_ANALYTICS_TOKEN) return null;

  return (
    <Script
      src="https://static.cloudflareinsights.com/beacon.min.js"
      strategy="afterInteractive"
      data-cf-beacon={JSON.stringify({ token: env.CLOUDFLARE_ANALYTICS_TOKEN })}
    />
  );
}

export { CloudflareAnalytics };
