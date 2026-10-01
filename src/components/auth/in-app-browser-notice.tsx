"use client";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type InAppBrowserNoticeProps = {
  url: string;
  intentUrl: string | null;
  appName: string;
};

function InAppBrowserNotice({ url, intentUrl, appName }: InAppBrowserNoticeProps) {
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Tautan disalin.");
    } catch {
      toast.error("Tautan tidak bisa disalin. Salin manual dari kotak di atas.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Google tidak mengizinkan login dari browser bawaan {appName}. Buka
        halaman ini di Chrome atau Safari, lalu masuk dari sana.
      </p>
      <p
        data-slot="in-app-browser-url"
        className="rounded-lg bg-muted px-3 py-2 font-mono text-xs break-all text-foreground"
      >
        {url}
      </p>
      <div className="flex flex-col gap-2">
        {intentUrl ? (
          <Button size="lg" render={<a href={intentUrl} />} nativeButton={false} className="w-full">
            Buka di Chrome
          </Button>
        ) : null}
        <Button
          size="lg"
          variant={intentUrl ? "outline" : "default"}
          onClick={handleCopy}
          className="w-full"
        >
          Salin tautan
        </Button>
      </div>
      {intentUrl ? null : (
        <p className="text-xs text-muted-foreground">
          Di iPhone, tempel tautan di Safari. Atau ketuk ikon menu di pojok
          layar lalu pilih Buka di Safari.
        </p>
      )}
    </div>
  );
}

export { InAppBrowserNotice };
