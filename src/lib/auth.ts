import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { getOAuthState } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/server/db";
import { env, getAuthConfig } from "@/lib/env";
import { USER_ROLES, resolveNewUserRole } from "@/lib/roles";

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
        before: async (user) => ({
          data: { ...user, role: resolveNewUserRole(await getOAuthState()) },
        }),
      },
    },
  },
  plugins: [nextCookies()],
});
