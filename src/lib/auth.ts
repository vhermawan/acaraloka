import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/server/db";
import { env, getAuthConfig } from "@/lib/env";

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
  plugins: [nextCookies()],
});
