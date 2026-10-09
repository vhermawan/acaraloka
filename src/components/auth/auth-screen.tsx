import Link from "next/link";
import { headers } from "next/headers";

import { AuthAlert } from "@/components/auth/auth-alert";
import { AuthDivider } from "@/components/auth/auth-divider";
import { AuthFrame } from "@/components/auth/auth-frame";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { InAppBrowserNotice } from "@/components/auth/in-app-browser-notice";
import { SignInForm } from "@/components/auth/sign-in-form";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { describeAuthNotice, type AuthNotice } from "@/lib/auth-notice";
import { APP_NAME } from "@/lib/brand";
import { env } from "@/lib/env";
import {
  buildChromeIntentUrl,
  detectInAppBrowser,
  isAndroid,
  type InAppBrowser,
} from "@/lib/in-app-browser";
import { LEGAL_OPERATOR } from "@/lib/legal";
import {
  ROLE_CONFLICT_MESSAGES,
  homePathFor,
  loginPathFor,
  pathWithNext,
  registerPathFor,
  type RoleConflict,
  type UserRole,
} from "@/lib/roles";

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
  notice?: AuthNotice | null;
};

const COPY: Record<UserRole, Record<AuthMode, { heading: string; description: string; button: string }>> = {
  PARTICIPANT: {
    login: {
      heading: `Masuk ke ${APP_NAME}`,
      description: "Daftar acara, simpan e-tiket, dan unduh sertifikatmu.",
      button: "Masuk dengan Google",
    },
    register: {
      heading: `Daftar di ${APP_NAME}`,
      description: "Buat akun untuk mendaftar acara, menyimpan e-tiket, dan mengunduh sertifikat.",
      button: "Daftar dengan Google",
    },
  },
  ORGANIZER: {
    login: {
      heading: "Masuk sebagai panitia",
      description: "Kelola acara, peserta, check-in, dan sertifikat.",
      button: "Masuk dengan Google",
    },
    register: {
      heading: "Buat akun panitia",
      description: "Daftar dengan Google atau email, lalu isi data penyelenggara untuk mulai membuat acara.",
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

function AuthFooter({ role, mode, next }: Pick<AuthScreenProps, "role" | "mode" | "next">) {
  const otherRole = role === "PARTICIPANT" ? "ORGANIZER" : "PARTICIPANT";
  const label = role === "ORGANIZER" ? "akun panitia" : "akun";
  return (
    <>
      {mode === "login" ? (
        <p>
          Belum punya {label}?{" "}
          <AuthLink href={pathWithNext(registerPathFor(role), role, next)}>Daftar</AuthLink>
        </p>
      ) : (
        <p>
          Sudah punya {label}?{" "}
          <AuthLink href={pathWithNext(loginPathFor(role), role, next)}>Masuk</AuthLink>
        </p>
      )}
      {role === "PARTICIPANT" ? (
        <p>
          Penyelenggara acara? <AuthLink href={loginPathFor(otherRole)}>Masuk sebagai panitia</AuthLink>
        </p>
      ) : (
        <p>
          Mau ikut acara? <AuthLink href={loginPathFor(otherRole)}>Masuk sebagai peserta</AuthLink>
        </p>
      )}
    </>
  );
}

async function AuthScreen({ role, mode, path, next, conflict, disabled, notice = null }: AuthScreenProps) {
  const userAgent = (await headers()).get("user-agent");
  const inApp = detectInAppBrowser(userAgent);
  const pageUrl = new URL(path, env.APP_BASE_URL);
  if (next !== homePathFor(role)) pageUrl.searchParams.set("next", next);
  const copy = COPY[role][mode];

  return (
    <AuthFrame
      heading={inApp ? "Buka di browser" : copy.heading}
      description={inApp ? "Halaman ini dibuka dari dalam aplikasi lain." : copy.description}
      footer={inApp ? undefined : <AuthFooter role={role} mode={mode} next={next} />}
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
            <AuthAlert>
              Akun ini dinonaktifkan. Hubungi admin {APP_NAME} di {LEGAL_OPERATOR.email} jika menurutmu ini keliru.
            </AuthAlert>
          ) : null}
          {conflict ? <AuthAlert>{ROLE_CONFLICT_MESSAGES[conflict]}</AuthAlert> : null}
          {notice ? <AuthAlert tone={describeAuthNotice(notice).tone}>{describeAuthNotice(notice).message}</AuthAlert> : null}
          <GoogleSignInButton role={role} next={next} label={copy.button} selectAccount={conflict !== null} />
          <AuthDivider>atau dengan email</AuthDivider>
          {mode === "login" ? <SignInForm role={role} next={next} /> : <SignUpForm role={role} next={next} />}
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
