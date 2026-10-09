import Link from "next/link";
import { headers } from "next/headers";

import { AuthFrame } from "@/components/auth/auth-frame";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { InAppBrowserNotice } from "@/components/auth/in-app-browser-notice";
import { APP_NAME } from "@/lib/brand";
import { env } from "@/lib/env";
import {
  buildChromeIntentUrl,
  detectInAppBrowser,
  isAndroid,
  type InAppBrowser,
} from "@/lib/in-app-browser";
import { LEGAL_OPERATOR } from "@/lib/legal";
import { ROLE_CONFLICT_MESSAGES, homePathFor, type RoleConflict, type UserRole } from "@/lib/roles";

const APP_NAMES: Record<InAppBrowser, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  line: "LINE",
};

type AuthMode = "login" | "register";

type AuthScreenProps = {
  role: UserRole;
  mode: AuthMode;
  path: string;
  next: string;
  conflict: RoleConflict | null;
  disabled: boolean;
};

const PARTICIPANT_COPY = {
  heading: `Masuk ke ${APP_NAME}`,
  description: "Daftar acara, simpan e-tiket, dan unduh sertifikatmu.",
  button: "Masuk dengan Google",
};

const COPY: Record<UserRole, Record<AuthMode, { heading: string; description: string; button: string }>> = {
  PARTICIPANT: { login: PARTICIPANT_COPY, register: PARTICIPANT_COPY },
  ORGANIZER: {
    login: {
      heading: "Masuk sebagai panitia",
      description: "Kelola acara, peserta, check-in, dan sertifikat.",
      button: "Masuk dengan Google",
    },
    register: {
      heading: "Buat akun panitia",
      description: "Masuk dengan Google, lalu isi data penyelenggara untuk mulai membuat acara.",
      button: "Daftar dengan Google",
    },
  },
};

function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-medium text-primary underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}

function AuthFooter({ role, mode }: Pick<AuthScreenProps, "role" | "mode">) {
  if (role === "PARTICIPANT") {
    return (
      <p>
        Penyelenggara acara? <AuthLink href="/organizer/login">Masuk sebagai panitia</AuthLink>
      </p>
    );
  }
  return (
    <>
      {mode === "login" ? (
        <p>
          Belum punya akun panitia? <AuthLink href="/organizer/register">Daftar</AuthLink>
        </p>
      ) : (
        <p>
          Sudah punya akun panitia? <AuthLink href="/organizer/login">Masuk</AuthLink>
        </p>
      )}
      <p>
        Mau ikut acara? <AuthLink href="/login">Masuk sebagai peserta</AuthLink>
      </p>
    </>
  );
}

async function AuthScreen({ role, mode, path, next, conflict, disabled }: AuthScreenProps) {
  const userAgent = (await headers()).get("user-agent");
  const inApp = detectInAppBrowser(userAgent);
  const pageUrl = new URL(path, env.APP_BASE_URL);
  if (next !== homePathFor(role)) pageUrl.searchParams.set("next", next);
  const copy = COPY[role][mode];

  return (
    <AuthFrame
      heading={inApp ? "Buka di browser" : copy.heading}
      description={inApp ? "Halaman ini dibuka dari dalam aplikasi lain." : copy.description}
      footer={inApp ? undefined : <AuthFooter role={role} mode={mode} />}
    >
      {inApp ? (
        <InAppBrowserNotice
          url={pageUrl.toString()}
          intentUrl={isAndroid(userAgent) ? buildChromeIntentUrl(pageUrl.toString()) : null}
          appName={APP_NAMES[inApp]}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {disabled ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              Akun ini dinonaktifkan. Hubungi admin {APP_NAME} di {LEGAL_OPERATOR.email}{" "}
              jika menurutmu ini keliru.
            </p>
          ) : null}
          {conflict ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {ROLE_CONFLICT_MESSAGES[conflict]}
            </p>
          ) : null}
          <GoogleSignInButton role={role} next={next} label={copy.button} selectAccount={conflict !== null} />
          <p className="text-center text-xs/5 text-muted-foreground">
            Dari akun Google kami memakai nama, email, dan foto profil. Baca{" "}
            <AuthLink href="/legal/privacy">Kebijakan Privasi</AuthLink> dan{" "}
            <AuthLink href="/legal/terms">Syarat Layanan</AuthLink>.
          </p>
        </div>
      )}
    </AuthFrame>
  );
}

export { AuthScreen };
