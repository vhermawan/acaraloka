"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

function PublicLinkRow({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
      toast.success("Tautan disalin.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Tautan gagal disalin. Salin manual dari kolom ini.");
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="min-w-0 text-sm">
        <span className="text-muted-foreground">Halaman publik: </span>
        <a
          href={path}
          target="_blank"
          rel="noopener"
          className="break-all font-mono text-[13px] text-foreground underline underline-offset-4 hover:text-primary"
        >
          {path}
          <span className="sr-only"> (tab baru)</span>
        </a>
      </p>
      <Button type="button" variant="outline" className="h-9 w-fit shrink-0 gap-1.5" onClick={handleCopy}>
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {copied ? "Tersalin" : "Salin tautan"}
      </Button>
    </div>
  );
}

export { PublicLinkRow };
