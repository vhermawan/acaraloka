import { cn } from "@/lib/utils";

function SignatureScribble({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 40" preserveAspectRatio="none" aria-hidden="true" className={cn("overflow-visible text-foreground", className)}>
      <path
        d="M4 30 C 18 6, 26 34, 38 20 S 56 2, 64 24 S 82 36, 96 12 L 116 26"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export { SignatureScribble };
