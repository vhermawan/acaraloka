import "server-only";
import { cookies } from "next/headers";

import { FLASH_COOKIE, FLASH_MAX_AGE_SECONDS, type FlashKey } from "@/lib/flash";

export async function setFlash(key: FlashKey) {
  const store = await cookies();
  store.set(FLASH_COOKIE, key, { path: "/", maxAge: FLASH_MAX_AGE_SECONDS, sameSite: "lax" });
}
