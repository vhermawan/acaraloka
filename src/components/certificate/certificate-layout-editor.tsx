"use client";

import { useState, useTransition } from "react";
import { Tabs } from "@base-ui/react/tabs";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ExternalLink, Minus, Plus } from "lucide-react";
import { toast } from "sonner";

import { saveLayout } from "@/app/organizer/events/[id]/certificate/actions";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { WEB_FONTS } from "@/components/certificate/certificate-web-fonts";
import { CERTIFICATE_CREDIT, CERTIFICATE_NUMBER_PREFIX } from "@/lib/brand";
import {
  ACCENT_COLORS,
  BORDER_PRESETS,
  FONT_FAMILIES,
  FONT_ROLE_LABELS,
  FONT_ROLE_OPTIONS,
  LABEL_MAX_LENGTH,
  LABEL_TITLES,
  NUDGE_STEP,
  TEXT_ELEMENT_LABELS,
  clampCoordinate,
  defaultCertificateLayout,
  spreadSigners,
  type AccentKey,
  type BorderKey,
  type CertificateLayout,
  type FontKey,
  type FontRole,
  type LabelKey,
  type TextAlign,
  type TextElementKey,
} from "@/lib/certificate-layout";
import { cn } from "cn";

type Selection =
  | { kind: "text"; key: TextElementKey }
  | { kind: "signer"; index: number }
  | { kind: "qr" }
  | { kind: "heading" };

const TEXT_KEYS: TextElementKey[] = ["recipientName", "eventTitle", "eventDate", "certificateNumber"];

const LABEL_KEYS: LabelKey[] = ["heading", "recipientPrefix", "eventPrefix"];

const INK_HEX = "#1c1c1f";
const MUTED_HEX = "#616166";

const FONT_ROLES = Object.keys(FONT_ROLE_LABELS) as FontRole[];

function fontStyle(key: FontKey, weight: "regular" | "bold") {
  const font = WEB_FONTS[key];
  return { fontFamily: font.family, fontWeight: font[weight] };
}

const ALIGN_LABELS: Record<TextAlign, string> = { left: "Kiri", center: "Tengah", right: "Kanan" };

const PREVIEW_TEXT: Record<TextElementKey, string> = {
  recipientName: "Nama Lengkap Peserta",
  eventTitle: "Nama acara",
  eventDate: "Tanggal · Penyelenggara",
  certificateNumber: `No. ${CERTIFICATE_NUMBER_PREFIX}-0000-0001`,
};

const tabClass =
  "flex h-9 items-center justify-center rounded-md text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[active]:text-foreground";

const optionActive = "border-primary bg-primary/8 text-primary hover:bg-primary/10 hover:text-primary";

function ColorField({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value: string | null;
  fallback: string;
  onChange: (value: string | null) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="flex items-center gap-2 text-sm font-medium">
        {label}
        <input
          type="color"
          value={value ?? fallback}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-12 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
        />
      </label>
      <Button type="button" variant="ghost" className="h-9 px-3" disabled={value === null} onClick={() => onChange(null)}>
        Bawaan
      </Button>
    </div>
  );
}

function Stepper({
  label,
  value,
  decreaseLabel,
  increaseLabel,
  onDecrease,
  onIncrease,
}: {
  label: string;
  value: number;
  decreaseLabel: string;
  increaseLabel: string;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-1">
        <Button type="button" variant="outline" size="icon" className="size-11" aria-label={decreaseLabel} onClick={onDecrease}>
          <Minus aria-hidden="true" />
        </Button>
        <span className="w-10 text-center font-mono text-sm tabular-nums" aria-live="polite">
          {value}
        </span>
        <Button type="button" variant="outline" size="icon" className="size-11" aria-label={increaseLabel} onClick={onIncrease}>
          <Plus aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

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
  if (selection.kind === "heading") return "Judul";
  if (selection.kind === "signer") return `Penandatangan ${selection.index + 1}`;
  return "QR verifikasi";
}

type CertificateLayoutEditorProps = {
  eventId: string;
  initialLayout: CertificateLayout;
  signers: { name: string; title: string }[];
  locked: boolean;
  pageWidth: number;
  pageHeight: number;
  backgroundUrl: string | null;
};

function CertificateLayoutEditor({
  eventId,
  initialLayout,
  signers,
  locked,
  pageWidth,
  pageHeight,
  backgroundUrl,
}: CertificateLayoutEditorProps) {
  const [layout, setLayout] = useState(initialLayout);
  const [savedLayout, setSavedLayout] = useState(initialLayout);
  const [selection, setSelection] = useState<Selection>({ kind: "text", key: "recipientName" });
  const [pending, startTransition] = useTransition();
  const signerCount = Math.max(1, signers.length);
  const dirty = JSON.stringify(layout) !== JSON.stringify(savedLayout);
  const scale = 100 / pageWidth;
  const customBackground = backgroundUrl !== null;
  const { theme } = layout;
  const accent = ACCENT_COLORS[theme.accent].hex;
  const headingFont = fontStyle(theme.fonts.heading, "bold");
  const nameFont = fontStyle(theme.fonts.name, "bold");
  const headingRegularFont = fontStyle(theme.fonts.heading, "regular");
  const bodyFont = fontStyle(theme.fonts.body, "regular");
  const bodyBoldFont = fontStyle(theme.fonts.body, "bold");

  function updateTheme(patch: Partial<Pick<CertificateLayout["theme"], "border" | "accent">>) {
    setLayout((current) => ({ ...current, theme: { ...current.theme, ...patch } }));
  }

  function updateLabel(key: LabelKey, patch: Partial<CertificateLayout["labels"][LabelKey]>) {
    setLayout((current) => ({ ...current, labels: { ...current.labels, [key]: { ...current.labels[key], ...patch } } }));
  }

  function updateFont(role: FontRole, key: FontKey) {
    setLayout((current) => ({
      ...current,
      theme: { ...current.theme, fonts: { ...current.theme.fonts, [role]: key } },
    }));
  }

  const selected =
    selection.kind === "text"
      ? layout[selection.key]
      : selection.kind === "heading"
        ? layout.heading
        : selection.kind === "signer"
          ? layout.signers[selection.index]
          : layout.verifyQr;

  function update(patch: Partial<{ x: number; y: number; fontSize: number; align: TextAlign; size: number; color: string | null }>) {
    setLayout((current) => {
      if (selection.kind === "heading") {
        const { color, ...rest } = patch;
        if (color === undefined) return { ...current, heading: { ...current.heading, ...rest } };
        return {
          ...current,
          heading: { ...current.heading, ...rest },
          labels: { ...current.labels, heading: { ...current.labels.heading, color } },
        };
      }
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
      toast.success("Tampilan dan posisi sertifikat disimpan.");
    });
  }

  const elementButtons: Selection[] = [
    ...TEXT_KEYS.map((key) => ({ kind: "text", key }) as const),
    ...Array.from({ length: signerCount }, (_, index) => ({ kind: "signer", index }) as const),
    { kind: "qr" },
  ];
  const showHeadingElement = customBackground && layout.heading.visible;
  if (showHeadingElement) elementButtons.unshift({ kind: "heading" });

  function toggleHeading(visible: boolean) {
    setLayout((current) => ({ ...current, heading: { ...current.heading, visible } }));
    if (!visible && selection.kind === "heading") setSelection({ kind: "text", key: "recipientName" });
    if (visible) setSelection({ kind: "heading" });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
      <div className="flex flex-col gap-3">
        <div
          className="relative w-full overflow-hidden rounded-md border border-border bg-white text-neutral-900 shadow-sm"
          style={{
            aspectRatio: `${pageWidth} / ${pageHeight}`,
            containerType: "inline-size",
            ...(backgroundUrl
              ? { backgroundImage: `url("${backgroundUrl}")`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat" }
              : {}),
          }}
          aria-label="Sketsa posisi sertifikat"
          role="group"
        >
          {!customBackground && theme.border === "classic" ? (
            <>
              <div className="pointer-events-none absolute inset-[2.85%] border-[3px]" style={{ borderColor: accent }} />
              <div className="pointer-events-none absolute inset-[4%] border" style={{ borderColor: accent }} />
            </>
          ) : null}
          {!customBackground && theme.border === "thin" ? (
            <div className="pointer-events-none absolute inset-[3.3%] border" style={{ borderColor: accent }} />
          ) : null}
          {!customBackground && theme.border === "corners" ? (
            <>
              {(
                [
                  "left-[2.85%] top-[4.03%] border-l-[3px] border-t-[3px]",
                  "right-[2.85%] top-[4.03%] border-r-[3px] border-t-[3px]",
                  "bottom-[4.03%] left-[2.85%] border-b-[3px] border-l-[3px]",
                  "bottom-[4.03%] right-[2.85%] border-b-[3px] border-r-[3px]",
                ] as const
              ).map((position) => (
                <div
                  key={position}
                  className={cn("pointer-events-none absolute h-[12%] w-[8.5%]", position)}
                  style={{ borderColor: accent }}
                />
              ))}
            </>
          ) : null}
          {!customBackground && layout.labels.heading.text.trim() ? (
            <>
              <p
                className="pointer-events-none absolute left-1/2 top-[19%] -translate-1/2 whitespace-nowrap"
                style={{ fontSize: `${38 * scale}cqw`, color: layout.labels.heading.color ?? accent, ...headingFont }}
              >
                {layout.labels.heading.text}
              </p>
              <span
                className="pointer-events-none absolute left-1/2 top-[23.4%] h-px w-[14.3%] -translate-x-1/2"
                style={{ backgroundColor: layout.labels.heading.color ?? accent }}
              />
            </>
          ) : null}
          {showHeadingElement && layout.labels.heading.text.trim() ? (
            <button
              type="button"
              onClick={() => setSelection({ kind: "heading" })}
              aria-label="Pilih judul"
              aria-pressed={selection.kind === "heading"}
              className={cn(
                "absolute whitespace-nowrap rounded-sm px-1 leading-tight outline-offset-2",
                selection.kind === "heading" ? "outline-2 outline-primary" : "outline-1 outline-dashed outline-neutral-400",
              )}
              style={{
                left: `${layout.heading.x * 100}%`,
                top: `${layout.heading.y * 100}%`,
                transform: TRANSLATE[layout.heading.align],
                fontSize: `${layout.heading.fontSize * scale}cqw`,
                color: layout.labels.heading.color ?? accent,
                ...headingFont,
              }}
            >
              {layout.labels.heading.text}
            </button>
          ) : null}
          {(
            [
              ["recipientName", "recipientPrefix", 12],
              ["eventTitle", "eventPrefix", 11],
            ] as const
          ).map(([elementKey, labelKey, size]) => {
            const element = layout[elementKey];
            const label = layout.labels[labelKey];
            if (!label.text.trim()) return null;
            const offset = (element.fontSize * (elementKey === "recipientName" ? 0.9 : 1) + 6) * scale;
            return (
              <p
                key={labelKey}
                className="pointer-events-none absolute whitespace-nowrap leading-tight"
                style={{
                  left: `${element.x * 100}%`,
                  top: `calc(${element.y * 100}% - ${offset}cqw)`,
                  transform: TRANSLATE[element.align],
                  fontSize: `${size * scale}cqw`,
                  color: label.color ?? MUTED_HEX,
                  ...headingRegularFont,
                }}
              >
                {label.text}
              </p>
            );
          })}
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
                  active ? "outline-2 outline-primary" : "outline-1 outline-dashed outline-neutral-400",
                )}
                style={{
                  left: `${element.x * 100}%`,
                  top: `${element.y * 100}%`,
                  transform: TRANSLATE[element.align],
                  fontSize: `${element.fontSize * scale}cqw`,
                  color: element.color ?? (key === "recipientName" || key === "eventTitle" ? INK_HEX : MUTED_HEX),
                  ...(key === "recipientName" ? nameFont : key === "eventTitle" ? bodyBoldFont : bodyFont),
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
                style={{
                  left: `${block.x * 100}%`,
                  top: `${block.y * 100}%`,
                  fontSize: `${block.fontSize * scale}cqw`,
                  ...bodyFont,
                }}
              >
                <span className="w-full border-t border-neutral-500" />
                <span className="truncate" style={bodyBoldFont}>{signer?.name ?? "Nama Penandatangan"}</span>
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
              "absolute -translate-1/2 bg-neutral-200 outline-offset-2",
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
            style={{ fontSize: `${8 * scale}cqw`, ...bodyFont }}
          >
            {CERTIFICATE_CREDIT}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Sketsa ini perkiraan. Tampilan akhir ada di pratinjau PDF, yang memakai posisi terakhir yang disimpan.
        </p>
      </div>

      <div className="flex flex-col gap-5">
        <Tabs.Root defaultValue="appearance" className="flex flex-col gap-5">
          <Tabs.List
            aria-label="Pengaturan sertifikat"
            className="relative z-0 grid grid-cols-2 rounded-lg bg-muted p-1"
          >
            <Tabs.Tab value="appearance" className={tabClass}>
              Tampilan
            </Tabs.Tab>
            <Tabs.Tab value="layout" className={tabClass}>
              Tata letak
            </Tabs.Tab>
            <Tabs.Indicator className="absolute top-1 left-0 -z-10 h-[calc(100%-0.5rem)] w-(--active-tab-width) translate-x-(--active-tab-left) rounded-md bg-background shadow-sm transition-[translate,width] duration-200 motion-reduce:transition-none" />
          </Tabs.List>

          <Tabs.Panel value="appearance" className="outline-none">
            <fieldset className="flex flex-col gap-5" disabled={locked}>
              <legend className="sr-only">Tampilan</legend>
              {customBackground ? null : (
              <>
              <div className="flex flex-col gap-2">
                <span id="theme-border-label" className="text-sm font-medium">
                  Border
                </span>
                <div role="group" aria-labelledby="theme-border-label" className="grid grid-cols-2 gap-2">
                  {(Object.entries(BORDER_PRESETS) as [BorderKey, string][]).map(([key, label]) => (
                    <Button
                      key={key}
                      type="button"
                      variant="outline"
                      className={cn("h-10", theme.border === key && optionActive)}
                      aria-pressed={theme.border === key}
                      onClick={() => updateTheme({ border: key })}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span id="theme-accent-label" className="text-sm font-medium">
                  Warna aksen
                  <span className="font-normal text-muted-foreground"> · {ACCENT_COLORS[theme.accent].label}</span>
                </span>
                <div role="group" aria-labelledby="theme-accent-label" className="flex flex-wrap gap-2">
                  {(Object.entries(ACCENT_COLORS) as [AccentKey, { label: string; hex: string }][]).map(([key, color]) => (
                    <button
                      key={key}
                      type="button"
                      aria-label={color.label}
                      aria-pressed={theme.accent === key}
                      title={color.label}
                      onClick={() => updateTheme({ accent: key })}
                      className={cn(
                        "flex size-11 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50",
                        theme.accent === key ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : "",
                      )}
                    >
                      <span aria-hidden="true" className="size-8 rounded-full" style={{ backgroundColor: color.hex }} />
                    </button>
                  ))}
                </div>
              </div>

              </>
              )}

              {FONT_ROLES.map((role) => (
                <label key={role} className="flex flex-col gap-1.5 text-sm font-medium">
                  Font {FONT_ROLE_LABELS[role].toLowerCase()}
                  <NativeSelect
                    value={theme.fonts[role]}
                    onChange={(event) => updateFont(role, event.target.value as FontKey)}
                    className="h-10 font-normal"
                  >
                    {FONT_ROLE_OPTIONS[role].map((key) => (
                      <option key={key} value={key}>
                        {FONT_FAMILIES[key]}
                      </option>
                    ))}
                  </NativeSelect>
                </label>
              ))}

              <div className="flex flex-col gap-4 border-t border-border pt-4">
                <span className="text-sm font-medium">Teks pendamping</span>
                {LABEL_KEYS.filter((key) => key !== "heading" || !customBackground || layout.heading.visible).map((key) => (
                  <div key={key} className="flex flex-col gap-2">
                    <label className="flex flex-col gap-1.5 text-sm">
                      {LABEL_TITLES[key]}
                      <input
                        type="text"
                        value={layout.labels[key].text}
                        maxLength={LABEL_MAX_LENGTH}
                        placeholder="Kosongkan untuk menyembunyikan"
                        onChange={(event) => updateLabel(key, { text: event.target.value })}
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </label>
                    <ColorField
                      label="Warna"
                      value={layout.labels[key].color}
                      fallback={key === "heading" ? accent : MUTED_HEX}
                      onChange={(color) => updateLabel(key, { color })}
                    />
                  </div>
                ))}
              </div>
            </fieldset>
          </Tabs.Panel>

          <Tabs.Panel value="layout" className="outline-none">
            <fieldset className="flex flex-col gap-5" disabled={locked}>
              <legend className="sr-only">Tata letak</legend>
              {customBackground ? (
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={layout.heading.visible}
                    onChange={(event) => toggleHeading(event.target.checked)}
                    className="size-4"
                  />
                  Tampilkan judul
                </label>
              ) : null}

              <div className="flex flex-col gap-2">
                <span id="element-label" className="text-sm font-medium">
                  Elemen
                </span>
                <div role="group" aria-labelledby="element-label" className="flex flex-wrap gap-2">
                  {elementButtons.map((item) => (
                    <Button
                      key={selectionLabel(item)}
                      type="button"
                      variant="outline"
                      className={cn("h-9 px-3", sameSelection(item, selection) && optionActive)}
                      aria-pressed={sameSelection(item, selection)}
                      onClick={() => setSelection(item)}
                    >
                      {selectionLabel(item)}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">Geser {selectionLabel(selection).toLowerCase()}</span>
                <div className="grid w-fit grid-cols-3 gap-1">
                  <span />
                  <Button type="button" variant="outline" size="icon" className="size-11" aria-label="Geser ke atas" onClick={() => nudge(0, -NUDGE_STEP)}>
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <span />
                  <Button type="button" variant="outline" size="icon" className="size-11" aria-label="Geser ke kiri" onClick={() => nudge(-NUDGE_STEP, 0)}>
                    <ArrowLeft aria-hidden="true" />
                  </Button>
                  <span className="flex items-center justify-center font-mono text-xs text-muted-foreground tabular-nums">
                    {Math.round(selected.x * 100)},{Math.round(selected.y * 100)}
                  </span>
                  <Button type="button" variant="outline" size="icon" className="size-11" aria-label="Geser ke kanan" onClick={() => nudge(NUDGE_STEP, 0)}>
                    <ArrowRight aria-hidden="true" />
                  </Button>
                  <span />
                  <Button type="button" variant="outline" size="icon" className="size-11" aria-label="Geser ke bawah" onClick={() => nudge(0, NUDGE_STEP)}>
                    <ArrowDown aria-hidden="true" />
                  </Button>
                  <span />
                </div>
              </div>

              {"fontSize" in selected ? (
                <Stepper
                  label="Ukuran huruf"
                  value={selected.fontSize}
                  decreaseLabel="Perkecil huruf"
                  increaseLabel="Perbesar huruf"
                  onDecrease={() => update({ fontSize: Math.max(8, selected.fontSize - 1) })}
                  onIncrease={() => update({ fontSize: Math.min(selection.kind === "signer" ? 24 : 72, selected.fontSize + 1) })}
                />
              ) : null}

              {"size" in selected ? (
                <Stepper
                  label="Ukuran QR"
                  value={Math.round(selected.size * 100)}
                  decreaseLabel="Perkecil QR"
                  increaseLabel="Perbesar QR"
                  onDecrease={() => update({ size: Math.max(0.06, Math.round((selected.size - 0.01) * 100) / 100) })}
                  onIncrease={() => update({ size: Math.min(0.25, Math.round((selected.size + 0.01) * 100) / 100) })}
                />
              ) : null}

              {selection.kind === "text" || selection.kind === "heading" ? (
                <ColorField
                  label="Warna teks"
                  value={selection.kind === "heading" ? layout.labels.heading.color : layout[selection.key].color}
                  fallback={
                    selection.kind === "heading"
                      ? accent
                      : selection.key === "recipientName" || selection.key === "eventTitle"
                        ? INK_HEX
                        : MUTED_HEX
                  }
                  onChange={(color) => update({ color })}
                />
              ) : null}

              {selection.kind === "text" || selection.kind === "heading" ? (
                <div className="flex flex-col gap-2">
                  <span id="align-label" className="text-sm font-medium">
                    Perataan
                  </span>
                  <div role="group" aria-labelledby="align-label" className="grid grid-cols-3 gap-2">
                    {(Object.entries(ALIGN_LABELS) as [TextAlign, string][]).map(([value, label]) => {
                      const active = (selection.kind === "heading" ? layout.heading : layout[selection.key]).align === value;
                      return (
                        <Button
                          key={value}
                          type="button"
                          variant="outline"
                          className={cn("h-10", active && optionActive)}
                          aria-pressed={active}
                          onClick={() => update({ align: value })}
                        >
                          {label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-1 border-t border-border pt-4">
                <Button type="button" variant="ghost" className="h-10 px-3" onClick={() => setLayout((current) => spreadSigners(current, signerCount))}>
                  Rapikan penandatangan
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10 px-3"
                  onClick={() => setLayout((current) => ({ ...defaultCertificateLayout(signerCount), theme: current.theme, labels: current.labels, heading: { ...defaultCertificateLayout(signerCount).heading, visible: current.heading.visible } }))}
                >
                  Kembalikan posisi awal
                </Button>
              </div>
            </fieldset>
          </Tabs.Panel>
        </Tabs.Root>
      </div>

      <div className="sticky bottom-0 z-10 -mx-5 -mb-5 flex items-center justify-between gap-3 rounded-b-xl border-t border-border bg-card px-5 py-3 lg:col-span-2">
        <p className="min-w-0 text-sm text-muted-foreground" aria-live="polite">
          {locked ? "Desain terkunci." : dirty ? "Ada perubahan yang belum disimpan." : "Semua perubahan tersimpan."}
        </p>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            aria-label="Pratinjau PDF (tab baru)"
            className="h-10 gap-1.5 px-3 sm:px-4"
            nativeButton={false}
            render={<a href={`/organizer/events/${eventId}/certificate/preview`} target="_blank" rel="noopener" />}
          >
            <ExternalLink aria-hidden="true" />
            <span aria-hidden="true" className="hidden sm:inline">
              Pratinjau PDF
            </span>
          </Button>
          <Button type="button" className="h-10 px-4" disabled={locked || !dirty || pending} onClick={handleSave}>
            {pending ? "Menyimpan..." : "Simpan"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export { CertificateLayoutEditor };
