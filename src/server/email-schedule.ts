import "server-only";

import { after } from "next/server";

import { env } from "@/lib/env";
import { drainOutbox } from "@/server/email-outbox";
import { recordError } from "@/server/error-log";

export function scheduleEmailDrain() {
  if (!env.EMAIL_ENABLED) return;
  after(async () => {
    try {
      await drainOutbox();
    } catch (error) {
      await recordError({ source: "email.drain", error }).catch(() => undefined);
    }
  });
}
