"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { renameMyRegistration } from "@/app/me/tickets/[id]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function RenameRegistrationForm({ registrationId, currentName }: { registrationId: string; currentName: string }) {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await renameMyRegistration(registrationId, name);
      setError(result.error ?? null);
      if (result.error) toast.error(result.error);
      else toast.success("Nama diperbarui.");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-border p-5">
      <div className="flex flex-col gap-1">
        <Label htmlFor="registration-name">Nama di sertifikat</Label>
        <p className="text-sm text-muted-foreground">Periksa ejaan namamu. Setelah sertifikat terbit, nama tidak bisa diubah.</p>
      </div>
      <Input
        id="registration-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={100}
        required
        aria-invalid={!!error}
        aria-describedby={error ? "registration-name-error" : undefined}
      />
      {error ? (
        <p id="registration-name-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-fit" disabled={pending || name.trim() === currentName}>
        {pending ? "Menyimpan..." : "Simpan nama"}
      </Button>
    </form>
  );
}

export { RenameRegistrationForm };
