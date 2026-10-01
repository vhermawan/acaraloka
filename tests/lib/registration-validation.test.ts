import { describe, expect, it } from "vitest";

import { encodeBase32, generateTicketCode } from "@/lib/ticket-code";
import { answerKey, buildRegistrationSchema, type RegistrationField } from "@/lib/validation/registration";

const fields: RegistrationField[] = [
  { id: "f1", label: "Instansi", type: "TEXT", required: true, options: [] },
  { id: "f2", label: "Ukuran kaos", type: "DROPDOWN", required: false, options: ["S", "M", "L"] },
  { id: "f3", label: "Jenis kelamin", type: "SINGLE_CHOICE", required: true, options: ["Laki-laki", "Perempuan"] },
];

const schema = buildRegistrationSchema(fields, ["t1"]);

const valid = {
  ticketTypeId: "t1",
  name: "Budi Santoso",
  email: "Budi@Example.com",
  phone: "0812 3456 7890",
  consent: "on",
  [answerKey("f1")]: "Universitas A",
  [answerKey("f2")]: "",
  [answerKey("f3")]: "Perempuan",
};

describe("buildRegistrationSchema", () => {
  it("normalizes input and snapshots answers with labels", () => {
    expect(schema.parse(valid)).toEqual({
      ticketTypeId: "t1",
      name: "Budi Santoso",
      email: "budi@example.com",
      phone: "081234567890",
      answers: [
        { fieldId: "f1", label: "Instansi", value: "Universitas A" },
        { fieldId: "f2", label: "Ukuran kaos", value: "" },
        { fieldId: "f3", label: "Jenis kelamin", value: "Perempuan" },
      ],
    });
  });

  it("requires consent, required answers, and a known ticket", () => {
    const result = schema.safeParse({ ...valid, consent: undefined, [answerKey("f1")]: " ", ticketTypeId: "t9" });
    expect(Object.keys(result.error!.flatten().fieldErrors).sort()).toEqual(["consent", "field_f1", "ticketTypeId"]);
  });

  it("rejects options outside the configured list", () => {
    const result = schema.safeParse({ ...valid, [answerKey("f2")]: "XXL", [answerKey("f3")]: "Lainnya" });
    expect(Object.keys(result.error!.flatten().fieldErrors).sort()).toEqual(["field_f2", "field_f3"]);
  });
});

describe("ticket code", () => {
  it("encodes RFC 4648 base32 without padding", () => {
    expect(encodeBase32(new TextEncoder().encode("foobar"))).toBe("mzxw6ytboi");
  });

  it("generates 128-bit codes", () => {
    const code = generateTicketCode();
    expect(code).toMatch(/^[a-z2-7]{26}$/);
    expect(generateTicketCode()).not.toBe(code);
  });
});
