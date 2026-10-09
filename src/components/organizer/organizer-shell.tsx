"use client";

import { useId, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Award, CalendarDays, EllipsisVertical, Menu, Plus, Shield, Ticket, X, type LucideIcon } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EVENT_SECTIONS, eventSectionHref, parseEventPath } from "@/components/events/event-sections";
import { authClient } from "@/lib/auth-client";
import { APP_NAME } from "@/lib/brand";

type ShellProps = {
  events: { id: string; title: string }[];
  orgName: string;
  userName: string;
  userEmail: string;
  isAdmin: boolean;
};

function pageTitle(pathname: string) {
  if (pathname === "/organizer/events/new") return "Buat acara";
  return parseEventPath(pathname)?.section.label ?? "Acara";
}

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  nested = false,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  nested?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-h-11 items-center gap-3 rounded-md px-3 text-sm transition-colors",
        nested ? "lg:min-h-9" : "lg:min-h-10",
        focusRing,
        active
          ? "bg-primary/8 font-medium text-primary before:absolute before:inset-y-2 before:w-0.5 before:rounded-full before:bg-accent-amber"
          : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
        active && (nested ? "before:-left-2.25" : "before:left-0"),
      )}
    >
      <Icon className="size-5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
      {label}
    </Link>
  );
}

function UserBlock({ userName, userEmail }: Pick<ShellProps, "userName" | "userEmail">) {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3 border-t border-sidebar-border pt-4">
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
      >
        {initials(userName)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{userName}</span>
        <span className="truncate text-xs text-muted-foreground">{userEmail}</span>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Menu akun" className="size-10" />}>
          <EllipsisVertical className="size-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-40">
          <DropdownMenuItem onClick={handleSignOut}>Keluar</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
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
  isAdmin,
  pathname,
  onNavigate,
}: ShellProps & { pathname: string; onNavigate?: () => void }) {
  const eventPath = parseEventPath(pathname);
  const currentEvent = eventPath ? events.find((event) => event.id === eventPath.eventId) : undefined;
  const listActive = pathname === "/organizer" || pathname === "/organizer/events/new";

  return (
    <div className="flex h-full flex-col gap-6 px-4 py-5">
      <div className="flex flex-col gap-5 px-2">
        <Link href="/" onClick={onNavigate} className={cn("w-fit rounded-sm", focusRing)}>
          <Image src="/logo/acaraloka-horizontal.svg" alt={APP_NAME} width={126} height={28} className="h-7 w-auto dark:hidden" />
          <Image
            src="/logo/acaraloka-horizontal-putih.svg"
            alt={APP_NAME}
            width={126}
            height={28}
            className="hidden h-7 w-auto dark:block"
          />
        </Link>
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
        <div className="flex flex-col gap-1">
          <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">Akun</p>
          <NavItem href="/me/tickets" label="Tiket saya" icon={Ticket} active={false} onNavigate={onNavigate} />
          <NavItem href="/me/certificates" label="Sertifikat saya" icon={Award} active={false} onNavigate={onNavigate} />
          {isAdmin ? <NavItem href="/admin" label="Admin" icon={Shield} active={false} onNavigate={onNavigate} /> : null}
        </div>
      </nav>

      <UserBlock userName={userName} userEmail={userEmail} />
    </div>
  );
}

function OrganizerShell({ children, ...props }: ShellProps & { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh overflow-y-auto border-r border-sidebar-border bg-sidebar lg:block">
        <SidebarContent {...props} pathname={pathname} />
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background px-4 lg:hidden">
        <Link href="/organizer" className={cn("shrink-0 rounded-sm", focusRing)}>
          <Image src="/logo/acaraloka-ikon.svg" alt={`${APP_NAME}, daftar acara`} width={28} height={28} className="size-7" />
        </Link>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{pageTitle(pathname)}</p>
        <DialogPrimitive.Root open={menuOpen} onOpenChange={setMenuOpen}>
          <DialogPrimitive.Trigger
            render={<Button variant="ghost" size="icon" className="-mr-2 size-11" aria-label="Buka menu" />}
          >
            <Menu className="size-5" aria-hidden="true" />
          </DialogPrimitive.Trigger>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/30 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
            <DialogPrimitive.Popup className="fixed inset-y-0 left-0 z-50 w-[min(18rem,calc(100vw-3rem))] overflow-y-auto border-r border-sidebar-border bg-sidebar outline-none duration-200 data-open:animate-in data-open:slide-in-from-left data-closed:animate-out data-closed:slide-out-to-left motion-reduce:animate-none">
              <DialogPrimitive.Title className="sr-only">Menu panitia</DialogPrimitive.Title>
              <DialogPrimitive.Close
                render={<Button variant="ghost" size="icon" className="absolute top-3 right-3 size-11" aria-label="Tutup menu" />}
              >
                <X className="size-5" aria-hidden="true" />
              </DialogPrimitive.Close>
              <SidebarContent {...props} pathname={pathname} onNavigate={closeMenu} />
            </DialogPrimitive.Popup>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      </header>

      <div className="min-w-0 px-4 py-6 sm:px-6 lg:p-8">
        <div className="mx-auto w-full max-w-260">{children}</div>
      </div>
    </div>
  );
}

export { OrganizerShell };
