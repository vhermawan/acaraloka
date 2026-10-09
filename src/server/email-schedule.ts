import "server-only";

import { after } from "next/server";

import { env } from "@/lib/env";
import { drainOutbox } from "@/server/email-outbox";
import { recordError } from "@/server/error-log";

const URGENT_RETRIES = 4;
const URGENT_RETRY_DELAY_MS = 400;

export function scheduleEmailDrain(options: { urgent?: boolean } = {}) {
  if (!env.EMAIL_ENABLED) return;
  after(async () => {
    try {
      let result = await drainOutbox();
      for (let attempt = 0; options.urgent && result.skipped && attempt < URGENT_RETRIES; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, URGENT_RETRY_DELAY_MS));
        result = await drainOutbox();
      }
    } catch (error) {
      await recordError({ source: "email.drain", error }).catch(() => undefined);
    }
  });
}
