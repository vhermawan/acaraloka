import { z } from "zod";

export const ticketTypeSchema = z.object({
  name: z.string().trim().min(2, "Nama tiket minimal 2 karakter.").max(60, "Nama tiket maksimal 60 karakter."),
  quota: z.coerce
    .number({ message: "Kuota harus berupa angka." })
    .int("Kuota harus bilangan bulat.")
    .min(1, "Kuota minimal 1.")
    .max(100000, "Kuota maksimal 100.000."),
});

export type TicketTypeInput = z.infer<typeof ticketTypeSchema>;
