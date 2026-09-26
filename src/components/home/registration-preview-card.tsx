"use client";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

function RegistrationPreviewCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pratinjau formulir pendaftaran</CardTitle>
        <CardDescription>
          Contoh field formulir. Belum terhubung ke sistem pendaftaran.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="preview-name">Nama lengkap</FieldLabel>
            <FieldContent>
              <Input id="preview-name" placeholder="Nama sesuai KTP" />
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel htmlFor="preview-email">Email</FieldLabel>
            <FieldContent>
              <Input
                id="preview-email"
                type="email"
                placeholder="nama@email.com"
              />
              <FieldDescription>
                Dipakai untuk mengirim e-tiket setelah pendaftaran aktif.
              </FieldDescription>
            </FieldContent>
          </Field>
        </FieldGroup>
      </CardContent>
      <CardFooter>
        <Button
          onClick={() =>
            toast.info("Ini pratinjau tampilan, penyimpanan belum aktif.")
          }
        >
          Simpan
        </Button>
      </CardFooter>
    </Card>
  );
}

export { RegistrationPreviewCard };
