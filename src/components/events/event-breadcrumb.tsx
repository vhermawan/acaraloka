"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { eventSectionHref, parseEventPath } from "@/components/events/event-sections";

const linkClass =
  "rounded-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

function EventBreadcrumb({ eventId, title }: { eventId: string; title: string }) {
  const pathname = usePathname();
  const section = parseEventPath(pathname)?.section;

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
        <li className="shrink-0">
          <Link href="/organizer" className={linkClass}>
            Acara
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li className="min-w-0 truncate">
          <Link href={eventSectionHref(eventId, "")} className={linkClass}>
            {title}
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li aria-current="page" className="shrink-0 font-medium text-foreground">
          {section?.label ?? "Detail"}
        </li>
      </ol>
    </nav>
  );
}

export { EventBreadcrumb };
