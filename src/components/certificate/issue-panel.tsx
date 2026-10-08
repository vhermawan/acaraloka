"use client";

import { useState, useTransition } from "react";
import { Info } from "lucide-react";
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

  const notice = blocker
    ? ISSUE_BLOCKER_MESSAGES[blocker]
    : waiting === 0
      ? followUp
        ? "Belum ada peserta baru yang menunggu sertifikat."
        : "Belum ada peserta yang check-in."
      : null;

  return (
    <div className="flex flex-col gap-5">
      <dl className="flex flex-wrap divide-x divide-border">
        <div className="flex flex-col gap-0.5 pr-6">
          <dt className="text-sm text-muted-foreground">Sudah terbit</dt>
          <dd className="text-2xl/8 font-bold tabular-nums">{issued}</dd>
        </div>
        <div className="flex flex-col gap-0.5 pl-6">
          <dt className="text-sm text-muted-foreground">Hadir, menunggu</dt>
          <dd className="text-2xl/8 font-bold tabular-nums">{waiting}</dd>
        </div>
      </dl>
      {notice ? (
        <p role="status" className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          {notice}
        </p>
      ) : null}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button className="h-10 w-fit px-4" disabled={disabled} />}>{label}</DialogTrigger>
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
    </div>
  );
}

export { IssuePanel };
