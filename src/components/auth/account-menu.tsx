"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import type { UserRole } from "@/lib/roles";

type AccountMenuProps = {
  name: string;
  email: string;
  role: UserRole;
};

function AccountMenu({ name, email, role }: AccountMenuProps) {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="sm" className="max-w-40" />}
      >
        <span className="truncate">{name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col">
            <span className="text-foreground">{name}</span>
            <span className="font-normal">{email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {role === "ADMIN" ? (
            <DropdownMenuItem render={<Link href="/admin" />}>Panel admin</DropdownMenuItem>
          ) : role === "ORGANIZER" ? (
            <DropdownMenuItem render={<Link href="/organizer" />}>Dashboard panitia</DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem render={<Link href="/me/tickets" />}>Tiket saya</DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/me/certificates" />}>Sertifikat saya</DropdownMenuItem>
            </>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>Keluar</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { AccountMenu };
