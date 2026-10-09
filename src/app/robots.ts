import type { MetadataRoute } from "next";

import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  if (process.env.VERCEL_ENV === "preview") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/auth/", "/login", "/legal/accept", "/me", "/organizer", "/sign/"],
    },
    sitemap: new URL("/sitemap.xml", env.APP_BASE_URL).toString(),
  };
}
