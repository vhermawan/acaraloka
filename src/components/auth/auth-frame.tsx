import Image from "next/image";
import Link from "next/link";

import { LoginShowcase } from "@/components/auth/login-showcase";
import { APP_NAME } from "@/lib/brand";

type AuthFrameProps = {
  heading: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

function AuthFrame({ heading, description, children, footer }: AuthFrameProps) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-sidebar p-4 sm:p-8">
      <div className="grid w-full max-w-5xl gap-3 rounded-2xl border border-border bg-card p-3 md:min-h-144 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <LoginShowcase />
        <section
          aria-labelledby="auth-heading"
          className="flex flex-col items-center justify-center px-3 py-10 sm:px-8"
        >
          <div className="flex w-full max-w-sm flex-col gap-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <Link
                href="/"
                className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <Image src="/logo/acaraloka-simbol.svg" alt={APP_NAME} width={24} height={29} className="h-7 w-auto" />
              </Link>
              <h1 id="auth-heading" className="text-2xl/8 font-semibold tracking-tight">
                {heading}
              </h1>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            {children}
            {footer ? <div className="flex flex-col items-center gap-1.5 text-center text-sm text-muted-foreground">{footer}</div> : null}
          </div>
        </section>
      </div>
    </div>
  );
}

export { AuthFrame };
