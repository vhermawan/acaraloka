"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { renameMyRegistration } from "@/app/me/tickets/[id]/actions";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registrantNameSchema } from "@/lib/validation/registration";

const renameSchema = z.object({ name: registrantNameSchema });

function RenameRegistrationForm({ registrationId, currentName }: { registrationId: string; currentName: string }) {
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<z.input<typeof renameSchema>, unknown, z.output<typeof renameSchema>>({
    resolver: zodResolver(renameSchema),
    defaultValues: { name: currentName },
    mode: "onTouched",
  });
  const unchanged = useWatch({ control, name: "name" }).trim() === currentName;

  const onSubmit = handleSubmit(({ name }) => {
    startTransition(async () => {
      const result = await renameMyRegistration(registrationId, name);
      if (result.error) {
        setError("name", { type: "server", message: result.error });
        toast.error(result.error);
        return;
      }
      toast.success("Nama diperbarui.");
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3 rounded-xl border border-border p-5">
      <div className="flex flex-col gap-1">
        <Label htmlFor="registration-name">Nama di sertifikat</Label>
        <p className="text-sm text-muted-foreground">Periksa ejaan namamu. Setelah sertifikat terbit, nama tidak bisa diubah.</p>
      </div>
      <Input
        id="registration-name"
        maxLength={100}
        placeholder="Nama lengkap sesuai ejaan yang benar"
        aria-invalid={!!errors.name}
        aria-describedby={errors.name ? "registration-name-error" : undefined}
        {...register("name")}
      />
      <FieldError id="registration-name-error" errors={[errors.name]} />
      <Button type="submit" className="w-fit" disabled={pending || unchanged}>
        {pending ? "Menyimpan..." : "Simpan nama"}
      </Button>
    </form>
  );
}

export { RenameRegistrationForm };
