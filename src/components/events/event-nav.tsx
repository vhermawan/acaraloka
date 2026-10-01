"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

type EventNavProps = {
  eventId: string;
};

function EventNav({ eventId }: EventNavProps) {
  const pathname = usePathname();
  const base = `/organizer/events/${eventId}`;
  const links = [
    { href: base, label: "Detail" },
    { href: `${base}/tickets`, label: "Tiket" },
    { href: `${base}/form`, label: "Formulir" },
  ];

  return (
    <nav aria-label="Pengaturan acara" className="flex gap-1 overflow-x-auto border-b border-border">
      {links.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors",
              active
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export { EventNav };
