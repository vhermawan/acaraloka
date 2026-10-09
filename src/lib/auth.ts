import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { APIError, createAuthMiddleware, getOAuthState } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/server/db";
import { env, getAuthConfig } from "@/lib/env";
import {
  AUTH_RATE_LIMITS,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  RESET_TTL_SECONDS,
  VERIFICATION_TTL_SECONDS,
  isTokenOlderThanAccount,
} from "@/lib/auth-config";
import { TERMS_VERSION } from "@/lib/legal";
import { USER_ROLES, loginPathFor, parseIntent, parseRole, resolveNewUserRole } from "@/lib/roles";
import {
  discardUnverifiedPasswordSignUp,
  markEmailVerified,
  sendAccountExists,
  sendResetPassword,
  sendVerificationEmail,
} from "@/server/auth-email";

const authConfig = getAuthConfig();

export const auth = betterAuth({
  baseURL: env.APP_BASE_URL,
  secret: authConfig.secret,
  socialProviders: {
    google: {
      clientId: authConfig.googleClientId,
      clientSecret: authConfig.googleClientSecret,
    },
  },
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    autoSignIn: false,
    minPasswordLength: MIN_PASSWORD_LENGTH,
    maxPasswordLength: MAX_PASSWORD_LENGTH,
    resetPasswordTokenExpiresIn: RESET_TTL_SECONDS,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword,
    onExistingUserSignUp: sendAccountExists,
    onPasswordReset: async ({ user }) => markEmailVerified(user.id),
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: VERIFICATION_TTL_SECONDS,
    sendVerificationEmail,
    beforeEmailVerification: async (user, request) => {
      const token = request ? new URL(request.url).searchParams.get("token") : null;
      if (token && !isTokenOlderThanAccount(token, user.createdAt)) return;
      throw new APIError("FOUND", undefined, {
        Location: `${loginPathFor(parseRole((user as { role?: unknown }).role))}?error=verify-expired`,
      });
    },
  },
  account: {
    accountLinking: { enabled: true, requireLocalEmailVerified: true },
  },
  rateLimit: {
    storage: "database",
    customRules: AUTH_RATE_LIMITS,
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") return;
      const body = (ctx.body ?? {}) as Record<string, unknown>;
      if (body.acceptTerms !== true) {
        throw new APIError("BAD_REQUEST", {
          code: "TERMS_NOT_ACCEPTED",
          message: "Setujui Syarat Layanan dan Kebijakan Privasi untuk mendaftar.",
        });
      }
      if (typeof body.email === "string") await discardUnverifiedPasswordSignUp(body.email.trim().toLowerCase());
    }),
  },
  user: {
    additionalFields: {
      phone: {
        type: "string",
        required: false,
      },
      isAdmin: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
      role: {
        type: [...USER_ROLES],
        required: false,
        defaultValue: "PARTICIPANT",
        input: false,
      },
      disabledAt: {
        type: "date",
        required: false,
      },
      termsVersion: {
        type: "string",
        required: false,
      },
      termsAcceptedAt: {
        type: "date",
        required: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user, context) => {
          if (context?.path === "/sign-up/email") {
            return {
              data: {
                ...user,
                role: parseIntent((context.body as Record<string, unknown> | undefined)?.intent),
                termsVersion: TERMS_VERSION,
                termsAcceptedAt: new Date(),
                disabledAt: null,
              },
            };
          }
          return { data: { ...user, role: resolveNewUserRole(await getOAuthState()) } };
        },
      },
    },
  },
  plugins: [nextCookies()],
});
