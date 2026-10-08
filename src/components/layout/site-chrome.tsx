"use client";

import { usePathname } from "next/navigation";

function isStandalonePath(pathname: string) {
  return pathname === "/login" || pathname === "/organizer" || pathname.startsWith("/organizer/");
}

function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (isStandalonePath(pathname)) return null;
  return children;
}

export { SiteChrome };
