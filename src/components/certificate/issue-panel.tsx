"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { issueEventCertificates } from "@/app/organizer/events/[id]/certificate/actions";
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
import { ISSUE_BLOCKER_MESSAGES, type IssueBlocker } from "@/lib/certificate-issue";

type IssuePanelProps = {
  eventId: string;
  blocker: IssueBlocker | null;
  issued: number;
  waiting: number;
  everIssued: boolean;
};

function IssuePanel({ eventId, blocker, issued, waiting, everIssued }: IssuePanelProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const followUp = everIssued;
  const label = followUp ? "Terbitkan susulan" : "Terbitkan sertifikat";
  const disabled = blocker !== null || waiting === 0;

  function confirm() {
    startTransition(async () => {
      const result = await issueEventCertificates(eventId);
      if (result.error) {
        toast.error(result.error);
        setOpen(false);
        return;
      }
      toast.success(`${result.issued ?? 0} sertifikat diterbitkan.`);
      setOpen(false);
    });
  }

  return (
    <section aria-labelledby="issue-heading" className="flex flex-col gap-4">
      <div className="flex max-w-prose flex-col gap-1">
        <h2 id="issue-heading" className="text-lg font-semibold">
          Terbitkan sertifikat
        </h2>
        <p className="text-sm text-muted-foreground">
          Sertifikat hanya untuk peserta yang sudah check-in. Peserta yang check-in setelahnya bisa disusulkan.
        </p>
      </div>
      <dl className="grid max-w-sm grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg border border-border px-4 py-3">
          <dt className="text-muted-foreground">Sudah terbit</dt>
          <dd className="text-lg font-semibold">{issued}</dd>
        </div>
        <div className="rounded-lg border border-border px-4 py-3">
          <dt className="text-muted-foreground">Hadir, menunggu</dt>
          <dd className="text-lg font-semibold">{waiting}</dd>
        </div>
      </dl>
      {blocker ? (
        <p role="status" className="text-sm text-muted-foreground">
          {ISSUE_BLOCKER_MESSAGES[blocker]}
        </p>
      ) : waiting === 0 ? (
        <p role="status" className="text-sm text-muted-foreground">
          {followUp ? "Belum ada peserta baru yang menunggu sertifikat." : "Belum ada peserta yang check-in."}
        </p>
      ) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button className="h-11 w-fit px-4" disabled={disabled} />}>{label}</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{label}?</DialogTitle>
            <DialogDescription>
              {waiting} sertifikat akan diterbitkan untuk peserta yang sudah check-in. Penerbitan tidak bisa dibatalkan,
              dan desain tidak bisa dibuka kuncinya lagi.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Tidak jadi</DialogClose>
            <Button onClick={confirm} disabled={pending}>
              {pending ? "Menerbitkan..." : "Terbitkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export { IssuePanel };
