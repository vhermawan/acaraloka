import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { proxy } from "@/proxy";

function visit(path: string, cookie?: string) {
  const request = new NextRequest(`http://localhost:3000${path}`, {
    headers: cookie ? { cookie } : undefined,
  });
  return proxy(request);
}

describe("proxy", () => {
  it("sends anonymous visitors of /admin to the admin login and keeps the target", () => {
    const response = visit("/admin/events?page=2");
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/admin/login");
    expect(location.searchParams.get("next")).toBe("/admin/events?page=2");
  });

  it("sends anonymous visitors of /admin itself to the admin login", () => {
    expect(new URL(visit("/admin").headers.get("location")!).pathname).toBe("/admin/login");
  });

  it("lets anyone reach the admin login", () => {
    expect(visit("/admin/login").headers.get("location")).toBeNull();
  });

  it("keeps the participant and organizer logins separate", () => {
    expect(new URL(visit("/me/tickets").headers.get("location")!).pathname).toBe("/login");
    expect(new URL(visit("/organizer").headers.get("location")!).pathname).toBe("/organizer/login");
    expect(visit("/organizer/login").headers.get("location")).toBeNull();
  });

  it("passes requests that carry a session cookie", () => {
    expect(visit("/admin", "better-auth.session_token=abc").headers.get("location")).toBeNull();
  });
});
