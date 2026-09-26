"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const URUTAN_OPTIONS = ["Terbaru", "Nama A-Z"] as const;

function InteractionPreviewCard() {
  const [urutan, setUrutan] = useState<(typeof URUTAN_OPTIONS)[number]>(
    URUTAN_OPTIONS[0],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-balance">Pratinjau interaksi</CardTitle>
        <CardDescription className="text-pretty">
          Contoh dialog konfirmasi dan menu tindakan yang akan dipakai di
          layar panitia.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Dialog>
          <DialogTrigger render={<Button variant="outline" />}>
            Lihat contoh dialog
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-balance">
                Contoh dialog konfirmasi
              </DialogTitle>
              <DialogDescription className="text-pretty">
                Dialog seperti ini nantinya dipakai untuk konfirmasi tindakan
                penting, misalnya membatalkan pendaftaran peserta.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter showCloseButton />
          </DialogContent>
        </Dialog>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" />}>
            Urutkan
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {URUTAN_OPTIONS.map((opsi) => (
              <DropdownMenuItem key={opsi} onClick={() => setUrutan(opsi)}>
                {opsi}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <p className="text-sm text-muted-foreground">
          Urutan aktif: <span className="text-foreground">{urutan}</span>
        </p>
      </CardContent>
    </Card>
  );
}

export { InteractionPreviewCard };
