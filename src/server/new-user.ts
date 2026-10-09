import "server-only";
import { APIError, getOAuthState } from "better-auth/api";

import { TERMS_VERSION } from "@/lib/legal";
import { resolveNewUserRole } from "@/lib/roles";

type CreateContext = { path?: string; body?: unknown } | null | undefined;

export function requireSelfServeRole(intent: unknown) {
  const role = resolveNewUserRole(intent);
  if (role) return role;
  throw new APIError("FORBIDDEN", {
    code: "ADMIN_SIGNUP_FORBIDDEN",
    message: "Akun admin tidak bisa dibuat dari halaman ini.",
  });
}

export async function prepareNewUser<T extends Record<string, unknown>>(user: T, context: CreateContext) {
  if (context?.path === "/sign-up/email") {
    const intent = (context.body as Record<string, unknown> | undefined)?.intent;
    return {
      data: {
        ...user,
        role: requireSelfServeRole(intent),
        termsVersion: TERMS_VERSION,
        termsAcceptedAt: new Date(),
        disabledAt: null,
      },
    };
  }
  const intent = (await getOAuthState())?.intent;
  return { data: { ...user, role: requireSelfServeRole(intent) } };
}
