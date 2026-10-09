import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { Container } from "@/components/layout/container";
import { StandaloneOnly } from "@/components/layout/site-chrome";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Halaman tidak ditemukan",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <Container className="flex min-h-[calc(100dvh-4rem)] max-w-2xl flex-col items-center justify-center gap-8 py-12 text-center">
      <StandaloneOnly>
        <Link
          href="/"
          className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Image
            src="/logo/acaraloka-horizontal.svg"
            alt={`${APP_NAME}, ke beranda`}
            width={431}
            height={96}
            className="h-10 w-auto dark:hidden"
          />
          <Image
            src="/logo/acaraloka-horizontal-putih.svg"
            alt={`${APP_NAME}, ke beranda`}
            width={431}
            height={96}
            className="hidden h-10 w-auto dark:block"
          />
        </Link>
      </StandaloneOnly>

      <div className="flex flex-col items-center gap-4">
        <p
          aria-hidden="true"
          className="text-8xl/none font-bold tracking-tighter text-primary tabular-nums sm:text-9xl/none"
        >
          404
        </p>
        <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
          Halaman tidak ditemukan
        </h1>
        <p className="max-w-md text-pretty text-muted-foreground">
          Alamat yang kamu buka tidak tersedia atau sudah dipindahkan. Periksa kembali tautannya, atau mulai lagi dari beranda.
        </p>
      </div>

      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <Button size="lg" className="h-11 px-5 text-[15px]" nativeButton={false} render={<Link href="/" />}>
          Ke beranda
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="h-11 px-5 text-[15px]"
          nativeButton={false}
          render={<Link href="/#cara-kerja" />}
        >
          Lihat cara kerja
        </Button>
      </div>
    </Container>
  );
}
