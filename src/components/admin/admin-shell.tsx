"use client";

import { usePathname } from "next/navigation";
import { Building2, CalendarDays, LayoutDashboard, Mail, TriangleAlert, Users, type LucideIcon } from "lucide-react";

import { AppShell, NavItem, SidebarLogo, UserBlock } from "@/components/layout/shell-parts";

type ShellProps = {
  userName: string;
  userEmail: string;
};

type AdminNavEntry = {
  href: string;
  label: string;
  icon: LucideIcon;
  ready: boolean;
};

const ADMIN_NAV: AdminNavEntry[] = [
  { href: "/admin", label: "Ringkasan", icon: LayoutDashboard, ready: true },
  { href: "/admin/users", label: "Pengguna", icon: Users, ready: true },
  { href: "/admin/organizers", label: "Panitia", icon: Building2, ready: true },
  { href: "/admin/events", label: "Acara", icon: CalendarDays, ready: true },
  { href: "/admin/email", label: "Email", icon: Mail, ready: false },
  { href: "/admin/logs", label: "Log error", icon: TriangleAlert, ready: true },
];

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function pageTitle(pathname: string) {
  return ADMIN_NAV.find((entry) => entry.ready && isActive(pathname, entry.href))?.label ?? "Admin";
}

function UpcomingItem({ label, icon: Icon }: Pick<AdminNavEntry, "label" | "icon">) {
  return (
    <span className="flex min-h-11 cursor-default items-center gap-3 rounded-md px-3 text-sm text-muted-foreground/60 lg:min-h-10">
      <Icon className="size-5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
      <span className="flex-1">{label}</span>
      <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-xs font-medium text-muted-foreground">Segera</span>
    </span>
  );
}

function SidebarContent({
  userName,
  userEmail,
  pathname,
  onNavigate,
}: ShellProps & { pathname: string; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-6 px-4 py-5">
      <div className="flex flex-col gap-5 px-2">
        <SidebarLogo onNavigate={onNavigate} />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold">Panel admin</span>
          <span className="text-xs text-muted-foreground">Internal</span>
        </div>
      </div>

      <nav aria-label="Navigasi admin" className="flex-1">
        <ul className="flex flex-col gap-1">
          {ADMIN_NAV.map((entry) => (
            <li key={entry.href}>
              {entry.ready ? (
                <NavItem
                  href={entry.href}
                  label={entry.label}
                  icon={entry.icon}
                  active={isActive(pathname, entry.href)}
                  onNavigate={onNavigate}
                />
              ) : (
                <UpcomingItem label={entry.label} icon={entry.icon} />
              )}
            </li>
          ))}
        </ul>
      </nav>

      <UserBlock userName={userName} userEmail={userEmail} signedOutPath="/admin/login" />
    </div>
  );
}

function AdminShell({ children, ...props }: ShellProps & { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AppShell
      title={pageTitle(pathname)}
      homeHref="/admin"
      homeLabel="ringkasan admin"
      menuTitle="Menu admin"
      sidebar={(onNavigate) => <SidebarContent {...props} pathname={pathname} onNavigate={onNavigate} />}
    >
      {children}
    </AppShell>
  );
}

export { AdminShell };
