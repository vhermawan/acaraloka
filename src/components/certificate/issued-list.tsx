"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { revokeEventCertificate } from "@/app/organizer/events/[id]/certificate/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

type IssuedCertificate = {
  id: string;
  number: string;
  recipientName: string;
  revokedAt: Date | null;
};

type IssuedListProps = {
  eventId: string;
  certificates: IssuedCertificate[];
};

function RevokeButton({ eventId, certificate }: { eventId: string; certificate: IssuedCertificate }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const reasonId = `revoke-reason-${certificate.id}`;

  function confirm() {
    startTransition(async () => {
      const result = await revokeEventCertificate(eventId, certificate.id, reason);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Sertifikat ${certificate.recipientName} dicabut.`);
      setOpen(false);
      setReason("");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" className="h-10 shrink-0 px-3 text-destructive hover:bg-destructive/5 hover:text-destructive" />}
      >
        Cabut
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cabut sertifikat {certificate.recipientName}?</DialogTitle>
          <DialogDescription>
            Halaman verifikasi akan menampilkan status dicabut dan peserta tidak bisa mengunduh PDF lagi. Pencabutan tidak
            bisa dibatalkan.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor={reasonId}>Alasan</FieldLabel>
          <Textarea id={reasonId} value={reason} onChange={(event) => setReason(event.target.value)} rows={3} />
          <FieldDescription>Alasan tersimpan di catatan audit dan tidak ditampilkan ke publik.</FieldDescription>
        </Field>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Tidak jadi</DialogClose>
          <Button variant="destructive" onClick={confirm} disabled={pending}>
            {pending ? "Mencabut..." : "Cabut sertifikat"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function IssuedList({ eventId, certificates }: IssuedListProps) {
  return (
    <section aria-labelledby="issued-heading" className="flex flex-col gap-4">
      <h2 id="issued-heading" className="text-lg/[26px] font-semibold">
        Sertifikat terbit <span className="font-normal text-muted-foreground tabular-nums">({certificates.length})</span>
      </h2>
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
        {certificates.map((certificate) => (
          <li key={certificate.id} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className={certificate.revokedAt ? "font-medium text-muted-foreground" : "font-medium"}>
                {certificate.recipientName}
              </span>
              <span className="font-mono text-xs break-all text-muted-foreground">{certificate.number}</span>
            </div>
            {certificate.revokedAt ? (
              <Badge variant="outline" className="border-transparent bg-destructive/10 text-destructive">
                Dicabut
              </Badge>
            ) : (
              <RevokeButton eventId={eventId} certificate={certificate} />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export { IssuedList };
