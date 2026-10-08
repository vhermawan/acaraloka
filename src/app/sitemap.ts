import type { MetadataRoute } from "next";

import { env } from "@/lib/env";
import { listSitemapEvents } from "@/server/public-event";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const url = (path: string) => new URL(path, env.APP_BASE_URL).toString();
  const events = await listSitemapEvents();

  return [
    { url: url("/"), changeFrequency: "weekly", priority: 1 },
    ...events.map((event) => ({
      url: url(`/e/${event.slug}`),
      lastModified: event.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    { url: url("/legal/terms"), changeFrequency: "yearly", priority: 0.3 },
    { url: url("/legal/privacy"), changeFrequency: "yearly", priority: 0.3 },
  ];
}
