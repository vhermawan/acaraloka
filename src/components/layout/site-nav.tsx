"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

import { CREATE_EVENT_HREF } from "@/components/layout/create-event-href";

const LINKS = [
  { href: "#fitur", label: "Fitur" },
  { href: "#cara-kerja", label: "Cara kerja" },
  { href: "#sertifikat", label: "Sertifikat" },
  { href: "#harga", label: "Harga" },
  { href: "#faq", label: "FAQ" },
];

const linkClass =
  "rounded-md text-[15px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

function SiteNav({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  if (pathname !== "/") return null;

  return (
    <>
      <nav aria-label="Navigasi halaman" className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 lg:flex">
        {LINKS.map((link) => (
          <a key={link.href} href={link.href} className={linkClass}>
            {link.label}
          </a>
        ))}
      </nav>

      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? "Tutup menu" : "Buka menu"}
        onClick={() => setOpen((value) => !value)}
        className="order-last -mr-2 inline-flex size-11 items-center justify-center rounded-md text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring lg:hidden"
      >
        {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
      </button>

      {open ? (
        <nav
          id="mobile-nav"
          aria-label="Navigasi halaman"
          className="absolute inset-x-0 top-full border-b border-border bg-background px-4 pt-2 pb-4 shadow-[0_8px_16px_-8px_rgb(0_0_0/0.08)] lg:hidden"
        >
          <ul className="flex flex-col">
            {LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} onClick={() => setOpen(false)} className={`${linkClass} flex min-h-11 items-center`}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          {signedIn ? null : (
            <Link
              href={CREATE_EVENT_HREF}
              onClick={() => setOpen(false)}
              className="mt-3 flex h-11 items-center justify-center rounded-lg bg-primary text-[15px] font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Buat acara gratis
            </Link>
          )}
        </nav>
      ) : null}
    </>
  );
}

export { SiteNav };
