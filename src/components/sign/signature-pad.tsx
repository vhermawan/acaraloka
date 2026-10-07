"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";

export type SignaturePadHandle = {
  clear: () => void;
  isEmpty: () => boolean;
  toPngDataUrl: () => string | null;
};

type Point = { x: number; y: number };

const STROKE_WIDTH = 2.6;
const TRIM_PADDING = 8;

type SignaturePadProps = {
  onChange: (empty: boolean) => void;
  label: string;
};

const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(function SignaturePad({ onChange, label }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<Point | null>(null);
  const emptyRef = useRef(true);

  const context = useCallback(() => canvasRef.current?.getContext("2d") ?? null, []);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const ctx = context();
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = STROKE_WIDTH;
    ctx.strokeStyle = "#111827";
    emptyRef.current = true;
    onChange(true);
  }, [context, onChange]);

  useEffect(() => {
    resize();
    let lastWidth = canvasRef.current?.getBoundingClientRect().width ?? 0;
    function handleResize() {
      const width = canvasRef.current?.getBoundingClientRect().width ?? 0;
      if (Math.abs(width - lastWidth) < 1) return;
      lastWidth = width;
      resize();
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [resize]);

  function pointFrom(event: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    const point = pointFrom(event);
    lastRef.current = point;
    const ctx = context();
    if (!ctx) return;
    ctx.beginPath();
    ctx.arc(point.x, point.y, STROKE_WIDTH / 2, 0, Math.PI * 2);
    ctx.fillStyle = "#111827";
    ctx.fill();
    if (emptyRef.current) {
      emptyRef.current = false;
      onChange(false);
    }
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || !lastRef.current) return;
    const ctx = context();
    if (!ctx) return;
    const point = pointFrom(event);
    const last = lastRef.current;
    const mid = { x: (last.x + point.x) / 2, y: (last.y + point.y) / 2 };
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.quadraticCurveTo(last.x, last.y, mid.x, mid.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastRef.current = point;
  }

  function handlePointerUp() {
    drawingRef.current = false;
    lastRef.current = null;
  }

  useImperativeHandle(
    ref,
    () => ({
      clear: () => {
        const canvas = canvasRef.current;
        const ctx = context();
        if (!canvas || !ctx) return;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
        emptyRef.current = true;
        onChange(true);
      },
      isEmpty: () => emptyRef.current,
      toPngDataUrl: () => {
        const canvas = canvasRef.current;
        const ctx = context();
        if (!canvas || !ctx || emptyRef.current) return null;
        const { width, height } = canvas;
        const pixels = ctx.getImageData(0, 0, width, height).data;
        let top = height;
        let left = width;
        let right = -1;
        let bottom = -1;
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            if (pixels[(y * width + x) * 4 + 3] === 0) continue;
            if (x < left) left = x;
            if (x > right) right = x;
            if (y < top) top = y;
            if (y > bottom) bottom = y;
          }
        }
        if (right < 0) return null;
        left = Math.max(0, left - TRIM_PADDING);
        top = Math.max(0, top - TRIM_PADDING);
        right = Math.min(width - 1, right + TRIM_PADDING);
        bottom = Math.min(height - 1, bottom + TRIM_PADDING);
        const trimmed = document.createElement("canvas");
        trimmed.width = right - left + 1;
        trimmed.height = bottom - top + 1;
        trimmed.getContext("2d")?.drawImage(canvas, left, top, trimmed.width, trimmed.height, 0, 0, trimmed.width, trimmed.height);
        return trimmed.toDataURL("image/png");
      },
    }),
    [context, onChange],
  );

  return (
    <canvas
      ref={canvasRef}
      aria-label={label}
      role="img"
      className="h-48 w-full touch-none rounded-lg border border-border bg-white sm:h-56"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
    />
  );
});

export { SignaturePad };
