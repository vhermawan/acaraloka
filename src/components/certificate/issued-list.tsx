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
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>Cabut</DialogTrigger>
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
      <h2 id="issued-heading" className="text-lg font-semibold">
        Sertifikat terbit
      </h2>
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
        {certificates.map((certificate) => (
          <li key={certificate.id} className="flex items-center justify-between gap-4 p-4">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="font-medium">{certificate.recipientName}</span>
              <span className="break-all font-mono text-xs text-muted-foreground">{certificate.number}</span>
            </div>
            {certificate.revokedAt ? (
              <Badge variant="destructive">Dicabut</Badge>
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
