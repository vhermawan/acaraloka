"use client";

import { useEffect, useRef, useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import {
  addDays,
  addMonthsToKey,
  formatDateKey,
  formatMonthView,
  localDateKey,
  monthGrid,
  shiftView,
  splitLocalDateTime,
  timeSlots,
  viewOfKey,
  weekdayIndex,
  type MonthView,
} from "@/lib/calendar";

type DateTimePickerProps = {
  id: string;
  name: string;
  defaultValue?: string;
  timezone: string;
  zoneLabel: string;
  invalid?: boolean;
  describedBy?: string;
  rangeStart?: string;
  onValueChange?: (value: string) => void;
};

const SLOTS = timeSlots(30);
const DEFAULT_TIME = "09:00";
const WEEKDAYS = [
  { short: "Sen", long: "Senin" },
  { short: "Sel", long: "Selasa" },
  { short: "Rab", long: "Rabu" },
  { short: "Kam", long: "Kamis" },
  { short: "Jum", long: "Jumat" },
  { short: "Sab", long: "Sabtu" },
  { short: "Min", long: "Minggu" },
];

function displayTime(time: string) {
  return time.replace(":", ".");
}

function shortDate(key: string) {
  return `${formatDateKey(key, { weekday: "short" })}, ${formatDateKey(key, { day: "numeric", month: "short", year: "numeric" })}`;
}

function DateTimePicker({
  id,
  name,
  defaultValue = "",
  timezone,
  zoneLabel,
  invalid,
  describedBy,
  rangeStart,
  onValueChange,
}: DateTimePickerProps) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<MonthView | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [today, setToday] = useState<string | null>(null);
  const focusRef = useRef<HTMLButtonElement>(null);
  const timeListRef = useRef<HTMLDivElement>(null);
  const keyboardMove = useRef(false);

  const selected = splitLocalDateTime(value);
  const selectedTime = selected?.time;
  const start = rangeStart ? splitLocalDateTime(rangeStart) : null;
  const slots = selected && !SLOTS.includes(selected.time) ? [...SLOTS, selected.time].sort() : SLOTS;
  const summary = selected ? `${shortDate(selected.date)} · ${displayTime(selected.time)} ${zoneLabel}` : null;

  useEffect(() => {
    if (!keyboardMove.current) return;
    keyboardMove.current = false;
    focusRef.current?.focus();
  }, [focusKey]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const list = timeListRef.current;
      const target = list?.querySelector<HTMLElement>('[aria-pressed="true"]') ?? list?.querySelector<HTMLElement>(`[data-time="${DEFAULT_TIME}"]`);
      if (!list || !target) return;
      const vertical = list.scrollHeight > list.clientHeight;
      if (vertical) list.scrollTop = target.offsetTop - list.clientHeight / 2 + target.clientHeight / 2;
      else list.scrollLeft = target.offsetLeft - list.clientWidth / 2 + target.clientWidth / 2;
    });
    return () => cancelAnimationFrame(frame);
  }, [open, selectedTime]);

  function commit(next: string) {
    setValue(next);
    onValueChange?.(next);
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      const todayKey = localDateKey(new Date(), timezone);
      const anchor = selected?.date ?? start?.date ?? todayKey;
      setToday(todayKey);
      setView(viewOfKey(anchor));
      setFocusKey(anchor);
    }
    setOpen(next);
  }

  function isBeforeStart(key: string) {
    return !!start && key < start.date;
  }

  function selectDate(key: string) {
    if (isBeforeStart(key)) return;
    commit(`${key}T${selected?.time ?? start?.time ?? DEFAULT_TIME}`);
    setFocusKey(key);
    setView(viewOfKey(key));
  }

  function selectTime(time: string) {
    const date = selected?.date ?? focusKey;
    if (!date) return;
    commit(`${date}T${time}`);
  }

  function moveFocus(key: string) {
    keyboardMove.current = true;
    setFocusKey(key);
    setView(viewOfKey(key));
  }

  function handleDayKeyDown(event: React.KeyboardEvent, key: string) {
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDays(key, -1),
      ArrowRight: () => addDays(key, 1),
      ArrowUp: () => addDays(key, -7),
      ArrowDown: () => addDays(key, 7),
      Home: () => addDays(key, -weekdayIndex(key)),
      End: () => addDays(key, 6 - weekdayIndex(key)),
      PageUp: () => addMonthsToKey(key, event.shiftKey ? -12 : -1),
      PageDown: () => addMonthsToKey(key, event.shiftKey ? 12 : 1),
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    moveFocus(move());
  }

  const weeks = view ? monthGrid(view) : [];
  const keysInGrid = weeks.flat().map((day) => day.key);
  const firstOfMonth = weeks.flat().find((day) => day.inMonth)?.key;
  const tabbableKey = focusKey && keysInGrid.includes(focusKey) ? focusKey : firstOfMonth;

  return (
    <>
      <input type="hidden" name={name} value={value} />
      <Popover.Root open={open} onOpenChange={handleOpenChange}>
        <Popover.Trigger
          id={id}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className="flex h-10 w-full min-w-0 items-center gap-2.5 rounded-lg border border-input bg-transparent px-3 text-left text-sm transition-colors outline-none hover:border-foreground/25 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[popup-open]:border-ring dark:bg-input/30"
        >
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
          <span className={cn("min-w-0 flex-1 truncate tabular-nums", !summary && "text-muted-foreground")}>
            {summary ?? "Pilih tanggal dan jam"}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner sideOffset={6} align="start" collisionPadding={16} className="z-50">
            <Popover.Popup
              initialFocus={focusRef}
              className="max-h-(--available-height) w-[min(calc(100vw-2rem),24.5rem)] origin-(--transform-origin) overflow-y-auto overscroll-contain rounded-xl border border-border bg-popover text-popover-foreground shadow-lg outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 motion-reduce:animate-none"
            >
              <Popover.Title className="sr-only">Pilih tanggal dan jam</Popover.Title>
              {view ? (
                <div className="flex flex-col sm:flex-row">
                  <div className="flex-1 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9"
                        aria-label="Bulan sebelumnya"
                        onClick={() => setView(shiftView(view, -1))}
                      >
                        <ChevronLeft aria-hidden="true" />
                      </Button>
                      <p aria-live="polite" className="text-sm font-semibold">
                        {formatMonthView(view)}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9"
                        aria-label="Bulan berikutnya"
                        onClick={() => setView(shiftView(view, 1))}
                      >
                        <ChevronRight aria-hidden="true" />
                      </Button>
                    </div>
                    <div role="grid" aria-label={formatMonthView(view)} className="flex flex-col gap-0.5">
                      <div role="row" className="grid grid-cols-7">
                        {WEEKDAYS.map((day) => (
                          <span
                            key={day.short}
                            role="columnheader"
                            aria-label={day.long}
                            className="flex h-8 items-center justify-center text-xs font-medium text-muted-foreground"
                          >
                            {day.short}
                          </span>
                        ))}
                      </div>
                      {weeks.map((week) => (
                        <div role="row" key={week[0].key} className="grid grid-cols-7">
                          {week.map((day) => {
                            const isSelected = selected?.date === day.key;
                            const isStart = start?.date === day.key;
                            const inRange = !!start && !!selected && day.key > start.date && day.key < selected.date;
                            const blocked = isBeforeStart(day.key);
                            return (
                              <div role="gridcell" key={day.key} aria-selected={isSelected} className="flex justify-center">
                                <button
                                  ref={day.key === tabbableKey ? focusRef : undefined}
                                  type="button"
                                  tabIndex={day.key === tabbableKey ? 0 : -1}
                                  aria-label={formatDateKey(day.key, {
                                    weekday: "long",
                                    day: "numeric",
                                    month: "long",
                                    year: "numeric",
                                  })}
                                  aria-current={day.key === today ? "date" : undefined}
                                  aria-disabled={blocked || undefined}
                                  onClick={() => selectDate(day.key)}
                                  onKeyDown={(event) => handleDayKeyDown(event, day.key)}
                                  onFocus={() => setFocusKey(day.key)}
                                  className={cn(
                                    "relative flex size-11 items-center justify-center rounded-lg text-sm tabular-nums transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-10",
                                    !day.inMonth && "text-muted-foreground",
                                    inRange && "bg-primary/8",
                                    isStart && !isSelected && "ring-1 ring-primary/40 ring-inset",
                                    isSelected
                                      ? "bg-primary font-semibold text-primary-foreground"
                                      : !blocked && "hover:bg-primary/10 hover:text-primary",
                                    blocked && "cursor-not-allowed text-muted-foreground/40",
                                    day.key === today &&
                                      "after:absolute after:bottom-1.5 after:size-1 after:rounded-full after:bg-accent-amber",
                                  )}
                                >
                                  {Number(day.key.slice(8))}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="border-t border-border sm:w-24 sm:border-t-0 sm:border-l">
                    <p className="px-3 pt-3 pb-1 text-xs font-medium text-muted-foreground">Jam</p>
                    <div
                      ref={timeListRef}
                      role="group"
                      aria-label="Jam"
                      className="flex gap-1 overflow-x-auto px-3 pb-3 sm:h-[19rem] sm:flex-col sm:overflow-x-visible sm:overflow-y-auto"
                    >
                      {slots.map((time) => {
                        const isSelected = selected?.time === time;
                        return (
                          <button
                            key={time}
                            type="button"
                            data-time={time}
                            aria-pressed={isSelected}
                            onClick={() => selectTime(time)}
                            className={cn(
                              "flex min-h-11 shrink-0 items-center justify-center rounded-lg px-3 text-sm tabular-nums transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9",
                              isSelected
                                ? "bg-primary font-semibold text-primary-foreground"
                                : "text-foreground hover:bg-primary/10 hover:text-primary",
                            )}
                          >
                            {displayTime(time)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/40 px-3 py-2.5">
                <p className={cn("min-w-0 truncate text-sm tabular-nums", summary ? "font-medium" : "text-muted-foreground")}>
                  {summary ?? "Pilih tanggal dulu"}
                </p>
                <Popover.Close render={<Button type="button" className="h-9 shrink-0 px-4" />}>Selesai</Popover.Close>
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </>
  );
}

export { DateTimePicker };
