import type { MetadataRoute } from "next";

import { env } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const url = (path: string) => new URL(path, env.APP_BASE_URL).toString();

  return [
    { url: url("/"), changeFrequency: "weekly", priority: 1 },
    { url: url("/legal/terms"), changeFrequency: "yearly", priority: 0.3 },
    { url: url("/legal/privacy"), changeFrequency: "yearly", priority: 0.3 },
  ];
}
