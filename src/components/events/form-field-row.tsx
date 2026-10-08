"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

import { ConfirmActionButton } from "@/components/events/confirm-action-button";
import { Button } from "@/components/ui/button";

type FormFieldRowProps = {
  number: number;
  label: string;
  meta: string;
  editable: boolean;
  isFirst: boolean;
  isLast: boolean;
  moveUp: () => Promise<void>;
  moveDown: () => Promise<void>;
  remove: () => Promise<void>;
  editForm: React.ReactNode;
};

function FormFieldRow({
  number,
  label,
  meta,
  editable,
  isFirst,
  isLast,
  moveUp,
  moveDown,
  remove,
  editForm,
}: FormFieldRowProps) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const formId = `edit-field-${number}`;

  return (
    <li className="flex flex-col gap-4 px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span
          aria-hidden="true"
          className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground tabular-nums"
        >
          {number}
        </span>
        <div className="flex min-w-[min(14rem,calc(100%-2.5rem))] flex-1 flex-col gap-0.5">
          <span className="text-sm font-semibold break-words">{label}</span>
          <span className="text-xs break-words text-muted-foreground">{meta}</span>
        </div>
        {editable ? (
          <div className="-ml-2 flex items-center gap-0.5 pl-10 sm:ml-0 sm:pl-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10"
              disabled={isFirst || pending}
              aria-label={`Naikkan ${label}`}
              onClick={() => startTransition(moveUp)}
            >
              <ArrowUp aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10"
              disabled={isLast || pending}
              aria-label={`Turunkan ${label}`}
              onClick={() => startTransition(moveDown)}
            >
              <ArrowDown aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-10 px-3"
              aria-expanded={editing}
              aria-controls={formId}
              onClick={() => setEditing((value) => !value)}
            >
              {editing ? "Tutup" : "Ubah"}
            </Button>
            <ConfirmActionButton
              triggerLabel="Hapus"
              triggerAriaLabel={`Hapus pertanyaan ${label}`}
              title={`Hapus pertanyaan "${label}"?`}
              description="Pertanyaan ini hilang dari formulir pendaftaran, dan kolom jawabannya tidak tampil lagi di tabel peserta."
              confirmLabel="Hapus"
              pendingLabel="Menghapus..."
              successMessage="Pertanyaan dihapus."
              action={remove}
            />
          </div>
        ) : null}
      </div>
      {editing ? (
        <div id={formId} className="rounded-lg border border-border bg-muted/40 p-4">
          {editForm}
        </div>
      ) : null}
    </li>
  );
}

export { FormFieldRow };
