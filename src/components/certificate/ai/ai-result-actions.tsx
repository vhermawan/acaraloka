"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { applyAiGeneration, reportAiGeneration } from "@/app/organizer/events/[id]/certificate/ai/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AI_QUOTA } from "@/lib/ai-config";
import type { AiDesignState } from "@/server/ai/overview";

type AiResultActionsProps = {
  eventId: string;
  generationId: string;
  used: boolean;
  logoPath: string | null;
  design: AiDesignState;
  reportAvailable: boolean;
};

function AiResultActions({ eventId, generationId, used, logoPath, design, reportAvailable }: AiResultActionsProps) {
  const router = useRouter();
  const [applyOpen, setApplyOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [applying, startApply] = useTransition();
  const [reporting, startReport] = useTransition();

  const isActive = design.activeGenerationId === generationId;
  const needsConfirm = design.hasCustomBackground && !isActive;
  const canReport = reportAvailable && !used && !isActive;

  function apply(confirmReplace: boolean) {
    startApply(async () => {
      const result = await applyAiGeneration(eventId, generationId, logoPath, confirmReplace);
      if (result.ok) {
        toast.success("Desain dipakai. Atur detailnya di editor.");
        router.push(`/organizer/events/${eventId}/certificate#step-design`);
        return;
      }
      if (result.reason === "NEEDS_CONFIRM") {
        setApplyOpen(true);
        return;
      }
      setApplyOpen(false);
      toast.error(result.message);
      router.refresh();
    });
  }

  function report() {
    startReport(async () => {
      const result = await reportAiGeneration(eventId, generationId);
      setReportOpen(false);
      if (!result.ok) {
        toast.error(result.message);
        router.refresh();
        return;
      }
      toast.success(`Terima kasih. Percobaan dikembalikan: sisa ${result.remaining} dari ${AI_QUOTA.perEventKind}.`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          className="h-10 px-4"
          disabled={design.locked || applying}
          onClick={() => (needsConfirm ? setApplyOpen(true) : apply(false))}
        >
          {applying ? "Memakai..." : isActive ? "Terapkan logo ini" : "Pakai desain ini"}
        </Button>
        {canReport ? (
          <Button
            type="button"
            variant="link"
            className="h-auto px-0 text-xs text-muted-foreground"
            onClick={() => setReportOpen(true)}
          >
            Hasil mengandung tulisan
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {design.locked
          ? "Desain sudah terkunci karena ada tanda tangan. Buka kunci di langkah 01 untuk memakai desain lain."
          : "Memakai desain atau mengganti logo tidak memotong kuota. Label dan pengaturan lain tetap bisa diubah di editor."}
      </p>

      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ganti desain saat ini?</DialogTitle>
            <DialogDescription>Desain ini akan menggantikan latar dan tata letak saat ini. Lanjutkan?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Tidak jadi</DialogClose>
            <Button onClick={() => apply(true)} disabled={applying}>
              {applying ? "Memakai..." : "Ya, ganti desain"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Laporkan hasil ini?</DialogTitle>
            <DialogDescription>
              Percobaannya dikembalikan dan hasil ini disembunyikan. Hanya bisa 1 kali per acara.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Tidak jadi</DialogClose>
            <Button variant="destructive" onClick={report} disabled={reporting}>
              {reporting ? "Melaporkan..." : "Laporkan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { AiResultActions };
