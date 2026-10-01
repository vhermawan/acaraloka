import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { prisma } from "@/server/db";

export const auth = betterAuth({
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
});
