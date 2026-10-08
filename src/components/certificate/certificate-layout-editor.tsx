"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveLayout } from "@/app/organizer/events/[id]/certificate/actions";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { CERTIFICATE_CREDIT, CERTIFICATE_NUMBER_PREFIX } from "@/lib/brand";
import {
  NUDGE_STEP,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  TEXT_ELEMENT_LABELS,
  clampCoordinate,
  defaultCertificateLayout,
  spreadSigners,
  type CertificateLayout,
  type TextAlign,
  type TextElementKey,
} from "@/lib/certificate-layout";
import { cn } from "cn";

type Selection = { kind: "text"; key: TextElementKey } | { kind: "signer"; index: number } | { kind: "qr" };

const TEXT_KEYS: TextElementKey[] = ["recipientName", "eventTitle", "eventDate", "certificateNumber"];

const ALIGN_LABELS: Record<TextAlign, string> = { left: "Kiri", center: "Tengah", right: "Kanan" };

const PREVIEW_TEXT: Record<TextElementKey, string> = {
  recipientName: "Nama Lengkap Peserta",
  eventTitle: "Nama acara",
  eventDate: "Tanggal · Penyelenggara",
  certificateNumber: `No. ${CERTIFICATE_NUMBER_PREFIX}-0000-0001`,
};

const TRANSLATE: Record<TextAlign, string> = {
  left: "translate(0, -50%)",
  center: "translate(-50%, -50%)",
  right: "translate(-100%, -50%)",
};

function sameSelection(a: Selection, b: Selection) {
  if (a.kind !== b.kind) return false;
  if (a.kind === "text" && b.kind === "text") return a.key === b.key;
  if (a.kind === "signer" && b.kind === "signer") return a.index === b.index;
  return true;
}

function selectionLabel(selection: Selection) {
  if (selection.kind === "text") return TEXT_ELEMENT_LABELS[selection.key];
  if (selection.kind === "signer") return `Penandatangan ${selection.index + 1}`;
  return "QR verifikasi";
}

type CertificateLayoutEditorProps = {
  eventId: string;
  initialLayout: CertificateLayout;
  signers: { name: string; title: string }[];
  locked: boolean;
};

function CertificateLayoutEditor({ eventId, initialLayout, signers, locked }: CertificateLayoutEditorProps) {
  const [layout, setLayout] = useState(initialLayout);
  const [savedLayout, setSavedLayout] = useState(initialLayout);
  const [selection, setSelection] = useState<Selection>({ kind: "text", key: "recipientName" });
  const [pending, startTransition] = useTransition();
  const signerCount = Math.max(1, signers.length);
  const dirty = JSON.stringify(layout) !== JSON.stringify(savedLayout);
  const scale = 100 / PAGE_WIDTH;

  const selected =
    selection.kind === "text"
      ? layout[selection.key]
      : selection.kind === "signer"
        ? layout.signers[selection.index]
        : layout.verifyQr;

  function update(patch: Partial<{ x: number; y: number; fontSize: number; align: TextAlign; size: number }>) {
    setLayout((current) => {
      if (selection.kind === "text") {
        return { ...current, [selection.key]: { ...current[selection.key], ...patch } };
      }
      if (selection.kind === "signer") {
        const next = current.signers.map((block, index) => (index === selection.index ? { ...block, ...patch } : block));
        return { ...current, signers: next };
      }
      return { ...current, verifyQr: { ...current.verifyQr, ...patch } };
    });
  }

  function nudge(dx: number, dy: number) {
    update({ x: clampCoordinate(selected.x + dx), y: clampCoordinate(selected.y + dy) });
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveLayout(eventId, layout);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setSavedLayout(layout);
      toast.success("Posisi sertifikat disimpan.");
    });
  }

  const elementButtons: Selection[] = [
    ...TEXT_KEYS.map((key) => ({ kind: "text", key }) as const),
    ...Array.from({ length: signerCount }, (_, index) => ({ kind: "signer", index }) as const),
    { kind: "qr" },
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex flex-col gap-3">
        <div
          className="relative w-full overflow-hidden rounded-md border border-border bg-white text-neutral-900 shadow-sm"
          style={{ aspectRatio: `${PAGE_WIDTH} / ${PAGE_HEIGHT}`, containerType: "inline-size" }}
          aria-label="Sketsa posisi sertifikat"
          role="group"
        >
          <div className="pointer-events-none absolute inset-[2.85%] border-[3px] border-primary" />
          <div className="pointer-events-none absolute inset-[4%] border border-primary" />
          <p
            className="pointer-events-none absolute left-1/2 top-[19%] -translate-x-1/2 -translate-y-1/2 font-serif font-bold text-primary"
            style={{ fontSize: `${38 * scale}cqw` }}
          >
            SERTIFIKAT
          </p>
          {TEXT_KEYS.map((key) => {
            const element = layout[key];
            const active = selection.kind === "text" && selection.key === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelection({ kind: "text", key })}
                aria-label={`Pilih ${TEXT_ELEMENT_LABELS[key]}`}
                aria-pressed={active}
                className={cn(
                  "absolute whitespace-nowrap rounded-sm px-1 leading-tight outline-offset-2",
                  key === "recipientName" ? "font-serif font-bold" : "",
                  active ? "outline-2 outline-primary" : "outline-1 outline-dashed outline-neutral-400",
                )}
                style={{
                  left: `${element.x * 100}%`,
                  top: `${element.y * 100}%`,
                  transform: TRANSLATE[element.align],
                  fontSize: `${element.fontSize * scale}cqw`,
                }}
              >
                {PREVIEW_TEXT[key]}
              </button>
            );
          })}
          {layout.signers.slice(0, signerCount).map((block, index) => {
            const active = selection.kind === "signer" && selection.index === index;
            const signer = signers[index];
            return (
              <button
                key={index}
                type="button"
                onClick={() => setSelection({ kind: "signer", index })}
                aria-label={`Pilih penandatangan ${index + 1}`}
                aria-pressed={active}
                className={cn(
                  "absolute flex w-[18%] -translate-x-1/2 flex-col items-center rounded-sm outline-offset-2",
                  active ? "outline-2 outline-primary" : "outline-1 outline-dashed outline-neutral-400",
                )}
                style={{ left: `${block.x * 100}%`, top: `${block.y * 100}%`, fontSize: `${block.fontSize * scale}cqw` }}
              >
                <span className="w-full border-t border-neutral-500" />
                <span className="truncate font-semibold">{signer?.name ?? "Nama Penandatangan"}</span>
                <span className="truncate text-neutral-600">{signer?.title ?? "Jabatan"}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setSelection({ kind: "qr" })}
            aria-label="Pilih QR verifikasi"
            aria-pressed={selection.kind === "qr"}
            className={cn(
              "absolute -translate-x-1/2 -translate-y-1/2 bg-neutral-200 outline-offset-2",
              selection.kind === "qr" ? "outline-2 outline-primary" : "outline-1 outline-dashed outline-neutral-400",
            )}
            style={{
              left: `${layout.verifyQr.x * 100}%`,
              top: `${layout.verifyQr.y * 100}%`,
              width: `${layout.verifyQr.size * 100}%`,
              aspectRatio: "1",
            }}
          >
            <span className="text-[1.2cqw] text-neutral-700">QR</span>
          </button>
          <p
            className="pointer-events-none absolute bottom-[6%] left-1/2 -translate-x-1/2 text-neutral-600"
            style={{ fontSize: `${8 * scale}cqw` }}
          >
            {CERTIFICATE_CREDIT}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Sketsa ini perkiraan. Tampilan akhir ada di pratinjau PDF, yang memakai posisi terakhir yang disimpan.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {locked ? (
          <p className="rounded-lg border border-border bg-muted px-3 py-2 text-sm">
            Desain terkunci karena penandatangan sudah menyetujui. Posisi tidak bisa diubah.
          </p>
        ) : null}

        <fieldset className="flex flex-col gap-2" disabled={locked}>
          <legend className="mb-2 text-sm font-medium">Elemen</legend>
          <div className="flex flex-wrap gap-2">
            {elementButtons.map((item) => (
              <Button
                key={selectionLabel(item)}
                type="button"
                size="sm"
                variant={sameSelection(item, selection) ? "default" : "outline"}
                className="h-9"
                aria-pressed={sameSelection(item, selection)}
                onClick={() => setSelection(item)}
              >
                {selectionLabel(item)}
              </Button>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-4" disabled={locked}>
          <legend className="mb-2 text-sm font-medium">Atur {selectionLabel(selection).toLowerCase()}</legend>

          <div className="grid w-fit grid-cols-3 gap-1">
            <span />
            <Button type="button" variant="outline" size="icon" className="size-11" aria-label="Geser ke atas" onClick={() => nudge(0, -NUDGE_STEP)}>
              ↑
            </Button>
            <span />
            <Button type="button" variant="outline" size="icon" className="size-11" aria-label="Geser ke kiri" onClick={() => nudge(-NUDGE_STEP, 0)}>
              ←
            </Button>
            <span className="flex items-center justify-center text-xs tabular-nums text-muted-foreground">
              {Math.round(selected.x * 100)},{Math.round(selected.y * 100)}
            </span>
            <Button type="button" variant="outline" size="icon" className="size-11" aria-label="Geser ke kanan" onClick={() => nudge(NUDGE_STEP, 0)}>
              →
            </Button>
            <span />
            <Button type="button" variant="outline" size="icon" className="size-11" aria-label="Geser ke bawah" onClick={() => nudge(0, NUDGE_STEP)}>
              ↓
            </Button>
            <span />
          </div>

          {"fontSize" in selected ? (
            <div className="flex items-center gap-3">
              <span className="text-sm">Ukuran huruf</span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11"
                aria-label="Perkecil huruf"
                onClick={() => update({ fontSize: Math.max(8, selected.fontSize - 1) })}
              >
                −
              </Button>
              <span className="w-8 text-center text-sm tabular-nums">{selected.fontSize}</span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11"
                aria-label="Perbesar huruf"
                onClick={() => update({ fontSize: Math.min(selection.kind === "signer" ? 24 : 72, selected.fontSize + 1) })}
              >
                +
              </Button>
            </div>
          ) : null}

          {"size" in selected ? (
            <div className="flex items-center gap-3">
              <span className="text-sm">Ukuran QR</span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11"
                aria-label="Perkecil QR"
                onClick={() => update({ size: Math.max(0.06, Math.round((selected.size - 0.01) * 100) / 100) })}
              >
                −
              </Button>
              <span className="w-8 text-center text-sm tabular-nums">{Math.round(selected.size * 100)}</span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11"
                aria-label="Perbesar QR"
                onClick={() => update({ size: Math.min(0.25, Math.round((selected.size + 0.01) * 100) / 100) })}
              >
                +
              </Button>
            </div>
          ) : null}

          {selection.kind === "text" ? (
            <label className="flex items-center gap-3 text-sm">
              Perataan
              <NativeSelect
                value={layout[selection.key].align}
                onChange={(event) => update({ align: event.target.value as TextAlign })}
                className="w-32"
              >
                {Object.entries(ALIGN_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </label>
          ) : null}
        </fieldset>

        <fieldset className="flex flex-wrap gap-2" disabled={locked}>
          <legend className="sr-only">Tata letak</legend>
          <Button type="button" variant="ghost" className="h-11" onClick={() => setLayout((current) => spreadSigners(current, signerCount))}>
            Rapikan penandatangan
          </Button>
          <Button type="button" variant="ghost" className="h-11" onClick={() => setLayout(defaultCertificateLayout(signerCount))}>
            Kembalikan posisi awal
          </Button>
        </fieldset>

        <div className="flex flex-wrap gap-2">
          <Button type="button" className="h-11 px-4" disabled={locked || !dirty || pending} onClick={handleSave}>
            {pending ? "Menyimpan..." : "Simpan posisi"}
          </Button>
          <Button
            variant="outline"
            className="h-11 px-4"
            nativeButton={false}
            render={<a href={`/organizer/events/${eventId}/certificate/preview`} target="_blank" rel="noopener" />}
          >
            Lihat pratinjau PDF
          </Button>
        </div>
        {dirty ? <p className="text-sm text-muted-foreground">Ada perubahan yang belum disimpan.</p> : null}
      </div>
    </div>
  );
}

export { CertificateLayoutEditor };
