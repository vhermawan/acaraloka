import { describe, expect, it } from "vitest";

import { formFieldSchema } from "@/lib/validation/form-field";
import { ticketTypeSchema } from "@/lib/validation/ticket";

describe("ticketTypeSchema", () => {
  it("coerces quota", () => {
    expect(ticketTypeSchema.parse({ name: "Umum", quota: "50" })).toEqual({ name: "Umum", quota: 50 });
  });

  it.each(["0", "-1", "1.5", "abc", ""])("rejects quota %j", (quota) => {
    expect(ticketTypeSchema.safeParse({ name: "Umum", quota }).success).toBe(false);
  });
});

describe("formFieldSchema", () => {
  it("drops options for text fields", () => {
    expect(formFieldSchema.parse({ label: "Instansi", type: "TEXT", required: true, options: "a\nb" })).toEqual({
      label: "Instansi",
      type: "TEXT",
      required: true,
      options: [],
    });
  });

  it("trims and dedupes choice options", () => {
    const result = formFieldSchema.parse({ label: "Ukuran kaos", type: "DROPDOWN", required: false, options: " S\nM\n\ns\nL " });
    expect(result.options).toEqual(["S", "M", "L"]);
  });

  it("requires at least two options for choice fields", () => {
    const result = formFieldSchema.safeParse({ label: "Jenis kelamin", type: "SINGLE_CHOICE", required: true, options: "Laki-laki" });
    expect(result.error?.flatten().fieldErrors.options).toBeDefined();
  });

  it("rejects labels that duplicate fixed fields", () => {
    const result = formFieldSchema.safeParse({ label: "Email", type: "TEXT", required: true, options: "" });
    expect(result.error?.flatten().fieldErrors.label).toBeDefined();
  });
});
