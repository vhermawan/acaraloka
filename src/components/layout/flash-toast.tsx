"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

import { FLASH_COOKIE, flashMessage } from "@/lib/flash";

function readFlashCookie() {
  const prefix = `${FLASH_COOKIE}=`;
  const entry = document.cookie.split("; ").find((part) => part.startsWith(prefix));
  return entry ? decodeURIComponent(entry.slice(prefix.length)) : null;
}

function FlashToast() {
  const pathname = usePathname();

  useEffect(() => {
    const value = readFlashCookie();
    if (value === null) return;
    document.cookie = `${FLASH_COOKIE}=; Max-Age=0; path=/; SameSite=Lax`;
    const message = flashMessage(value);
    if (message) toast.success(message, { id: `flash-${value}` });
  }, [pathname]);

  return null;
}

export { FlashToast };
