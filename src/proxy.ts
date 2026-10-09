import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

const ORGANIZER_PUBLIC_PATHS = new Set(["/organizer/login", "/organizer/register"]);

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (ORGANIZER_PUBLIC_PATHS.has(pathname)) return NextResponse.next();
  if (getSessionCookie(request)) return NextResponse.next();

  const isOrganizerArea = pathname === "/organizer" || pathname.startsWith("/organizer/");
  const loginUrl = new URL(isOrganizerArea ? "/organizer/login" : "/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/me/:path*", "/organizer/:path*", "/admin/:path*"],
};
