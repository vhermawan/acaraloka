import Link from "next/link";

const LINKS = [
  { href: "/admin", label: "Ringkasan" },
  { href: "/admin/events", label: "Acara" },
  { href: "/admin/logs", label: "Log error" },
] as const;

function AdminNav() {
  return (
    <nav aria-label="Navigasi admin" className="flex gap-4 text-sm">
      {LINKS.map((link) => (
        <Link key={link.href} href={link.href} className="text-muted-foreground hover:text-foreground">
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

export { AdminNav };
