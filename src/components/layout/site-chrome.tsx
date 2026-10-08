"use client";

import { usePathname } from "next/navigation";

function isDashboardPath(pathname: string) {
  return pathname === "/organizer" || pathname.startsWith("/organizer/");
}

function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (isDashboardPath(pathname)) return null;
  return children;
}

export { SiteChrome };
