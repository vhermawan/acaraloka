"use client";

import { useId } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EVENT_SECTIONS, eventSectionHref, parseEventPath } from "@/components/events/event-sections";
import { AppShell, NavItem, SidebarLogo, UserBlock } from "@/components/layout/shell-parts";

type ShellProps = {
  events: { id: string; title: string }[];
  orgName: string;
  userName: string;
  userEmail: string;
};

function pageTitle(pathname: string) {
  if (pathname === "/organizer/events/new") return "Buat acara";
  return parseEventPath(pathname)?.section.label ?? "Acara";
}

function EventMenu({
  eventId,
  title,
  activeSegment,
  onNavigate,
}: {
  eventId: string;
  title: string;
  activeSegment: string;
  onNavigate?: () => void;
}) {
  const titleId = useId();
  return (
    <div role="group" aria-labelledby={titleId} className="ml-5.5 flex flex-col gap-0.5 border-l border-sidebar-border pl-2">
      <p id={titleId} className="line-clamp-2 px-3 pt-1 pb-1.5 text-xs/4 font-semibold text-foreground">
        {title}
      </p>
      {EVENT_SECTIONS.map((section) => (
        <NavItem
          key={section.segment}
          href={eventSectionHref(eventId, section.segment)}
          label={section.label}
          icon={section.icon}
          active={section.segment === activeSegment}
          nested
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
}

function SidebarContent({
  events,
  orgName,
  userName,
  userEmail,
  pathname,
  onNavigate,
}: ShellProps & { pathname: string; onNavigate?: () => void }) {
  const eventPath = parseEventPath(pathname);
  const currentEvent = eventPath ? events.find((event) => event.id === eventPath.eventId) : undefined;
  const listActive = pathname === "/organizer" || pathname === "/organizer/events/new";

  return (
    <div className="flex h-full flex-col gap-6 px-4 py-5">
      <div className="flex flex-col gap-5 px-2">
        <SidebarLogo onNavigate={onNavigate} />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold">{orgName}</span>
          <span className="text-xs text-muted-foreground">Panitia</span>
        </div>
      </div>

      <Button
        nativeButton={false}
        render={<Link href="/organizer/events/new" onClick={onNavigate} />}
        className="h-10 w-full gap-2"
      >
        <Plus className="size-4" aria-hidden="true" />
        Buat acara
      </Button>

      <nav aria-label="Navigasi panitia" className="flex flex-1 flex-col gap-6">
        <div className="flex flex-col gap-1">
          <NavItem href="/organizer" label="Acara" icon={CalendarDays} active={listActive} onNavigate={onNavigate} />
          {eventPath ? (
            <EventMenu
              eventId={eventPath.eventId}
              title={currentEvent?.title ?? "Acara ini"}
              activeSegment={eventPath.section.segment}
              onNavigate={onNavigate}
            />
          ) : null}
        </div>
      </nav>

      <UserBlock userName={userName} userEmail={userEmail} signedOutPath="/" />
    </div>
  );
}

function OrganizerShell({ children, ...props }: ShellProps & { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AppShell
      title={pageTitle(pathname)}
      homeHref="/organizer"
      homeLabel="daftar acara"
      menuTitle="Menu panitia"
      sidebar={(onNavigate) => <SidebarContent {...props} pathname={pathname} onNavigate={onNavigate} />}
    >
      {children}
    </AppShell>
  );
}

export { OrganizerShell };
