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

type AccountMenuProps = {
  name: string;
  email: string;
  isOrganizer: boolean;
  isAdmin: boolean;
};

function AccountMenu({ name, email, isOrganizer, isAdmin }: AccountMenuProps) {
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
          {isOrganizer ? (
            <DropdownMenuItem render={<Link href="/organizer" />}>Dashboard panitia</DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem render={<Link href="/me/tickets" />}>Tiket saya</DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/me/certificates" />}>Sertifikat saya</DropdownMenuItem>
            </>
          )}
          {isAdmin ? (
            <DropdownMenuItem render={<Link href="/admin" />}>Admin</DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>Keluar</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { AccountMenu };
