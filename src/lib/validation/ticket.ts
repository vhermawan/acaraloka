import { z } from "zod";

export const TICKET_PRICE_MAX = 100_000_000;

export const ticketTypeSchema = z.object({
  name: z.string().trim().min(2, "Nama tiket minimal 2 karakter.").max(60, "Nama tiket maksimal 60 karakter."),
  quota: z.coerce
    .number({ message: "Kuota harus berupa angka." })
    .int("Kuota harus bilangan bulat.")
    .min(1, "Kuota minimal 1.")
    .max(100000, "Kuota maksimal 100.000."),
  price: z.coerce
    .number({ message: "Harga harus berupa angka." })
    .int("Harga harus bilangan bulat.")
    .min(0, "Harga tidak boleh negatif.")
    .max(TICKET_PRICE_MAX, "Harga maksimal Rp100.000.000."),
});

export type TicketTypeInput = z.infer<typeof ticketTypeSchema>;
