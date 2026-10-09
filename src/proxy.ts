import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = new Set(["/organizer/login", "/organizer/register", "/admin/login"]);

function isArea(pathname: string, area: string) {
  return pathname === area || pathname.startsWith(`${area}/`);
}

function loginPathForArea(pathname: string) {
  if (isArea(pathname, "/admin")) return "/admin/login";
  if (isArea(pathname, "/organizer")) return "/organizer/login";
  return "/login";
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();
  if (getSessionCookie(request)) return NextResponse.next();

  const loginUrl = new URL(loginPathForArea(pathname), request.url);
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/me/:path*", "/organizer/:path*", "/admin/:path*"],
};
