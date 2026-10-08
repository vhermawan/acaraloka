import Image from "next/image";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { CREATE_EVENT_HREF } from "@/components/layout/create-event-href";
import { APP_NAME } from "@/lib/brand";

const COLUMNS = [
  {
    title: "Produk",
    links: [
      { href: "/#fitur", label: "Fitur" },
      { href: "/#cara-kerja", label: "Cara kerja" },
      { href: "/#harga", label: "Harga" },
      { href: "/#template", label: "Template sertifikat" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/legal/terms", label: "Ketentuan layanan" },
      { href: "/legal/privacy", label: "Kebijakan privasi" },
    ],
  },
  {
    title: "Akun",
    links: [
      { href: "/login", label: "Masuk" },
      { href: CREATE_EVENT_HREF, label: "Buat acara" },
      { href: "/me/tickets", label: "Tiket Saya" },
    ],
  },
];

function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer data-slot="site-footer" className="border-t border-border bg-background">
      <Container className="flex max-w-[75rem] flex-col gap-12 pt-16 pb-10">
        <div className="grid gap-10 md:grid-cols-[1fr_auto] md:gap-20">
          <div className="flex max-w-[300px] flex-col gap-2.5">
            <Image
              src="/logo/acaraloka-horizontal.svg"
              alt={APP_NAME}
              width={431}
              height={96}
              className="-ml-2 h-12 w-auto self-start"
            />
            <p className="text-sm leading-[22px] text-muted-foreground">Pendaftaran, check-in, dan sertifikat acara dalam satu tempat.</p>
          </div>
          <nav aria-label="Tautan footer" className="grid grid-cols-2 gap-x-10 gap-y-8 sm:grid-cols-3 sm:gap-x-20">
            {COLUMNS.map((column) => (
              <div key={column.title} className="flex flex-col gap-2">
                <p className="text-sm font-semibold text-foreground">{column.title}</p>
                <ul className="flex flex-col">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="inline-flex min-h-11 items-center rounded-sm sm:min-h-8 text-[15px] text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className="flex flex-col gap-2 border-t border-border pt-8 text-[13px] text-muted-foreground sm:flex-row sm:justify-between">
          <p>&copy; {year} {APP_NAME}.</p>
          <p>Dibuat untuk panitia acara di Indonesia.</p>
        </div>
      </Container>
    </footer>
  );
}

export { SiteFooter };
