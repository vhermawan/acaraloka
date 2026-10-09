"use client";

import { usePathname } from "next/navigation";

function isArea(pathname: string, area: string) {
  return pathname === area || pathname.startsWith(`${area}/`);
}

function isStandalonePath(pathname: string) {
  return pathname === "/login" || isArea(pathname, "/organizer") || isArea(pathname, "/admin");
}

function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (isStandalonePath(pathname)) return null;
  return children;
}

export { SiteChrome };
